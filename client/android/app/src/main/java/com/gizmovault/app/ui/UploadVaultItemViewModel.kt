package com.gizmovault.app.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.gizmovault.app.data.MediaStorageResolver
import com.gizmovault.app.data.VaultRepository
import com.gizmovault.app.model.MediaAttachment
import com.gizmovault.app.model.UploadStatus
import com.gizmovault.app.model.VaultItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class UploadUiState(
    val title: String = "",
    val description: String = "",
    val attachments: List<MediaAttachment> = emptyList(),
    val maxAttachments: Int = 5,
    val isProcessingMedia: Boolean = false,
    val uploadStatus: UploadStatus = UploadStatus.PENDING,
    val uploadProgress: Float = 0f,
    val isUploading: Boolean = false,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    val savedItem: VaultItem? = null
) {
    val canAddMoreMedia: Boolean
        get() = attachments.size < maxAttachments

    val remainingMediaSlots: Int
        get() = (maxAttachments - attachments.size).coerceAtLeast(0)

    val isFormValid: Boolean
        get() = title.isNotBlank() && description.isNotBlank()
}

class UploadVaultItemViewModel(
    application: Application,
    private val repository: VaultRepository = VaultRepository(application),
    private val storageResolver: MediaStorageResolver = MediaStorageResolver(application)
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(UploadUiState())
    val uiState: StateFlow<UploadUiState> = _uiState.asStateFlow()

    fun onTitleChange(newTitle: String) {
        _uiState.update { it.copy(title = newTitle, errorMessage = null) }
    }

    fun onDescriptionChange(newDesc: String) {
        _uiState.update { it.copy(description = newDesc, errorMessage = null) }
    }

    fun onMediaSelected(uris: List<Uri>) {
        if (uris.isEmpty()) return

        val currentCount = _uiState.value.attachments.size
        val availableSlots = _uiState.value.maxAttachments - currentCount

        if (availableSlots <= 0) {
            _uiState.update {
                it.copy(errorMessage = "Maximum ${_uiState.value.maxAttachments} attachments allowed")
            }
            return
        }

        val urisToProcess = uris.take(availableSlots)

        viewModelScope.launch {
            _uiState.update { it.copy(isProcessingMedia = true, errorMessage = null) }
            val newAttachments = mutableListOf<MediaAttachment>()

            for (uri in urisToProcess) {
                val resolved = storageResolver.resolveMediaUri(uri)
                if (resolved != null) {
                    newAttachments.add(resolved)
                }
            }

            _uiState.update { state ->
                val combined = state.attachments + newAttachments
                state.copy(
                    attachments = combined.take(state.maxAttachments),
                    isProcessingMedia = false,
                    statusMessage = if (uris.size > availableSlots) {
                        "Only $availableSlots items added (max 5 limit reached)"
                    } else null
                )
            }
        }
    }

    fun onRemoveAttachment(attachmentId: String) {
        val attachmentToRemove = _uiState.value.attachments.find { it.id == attachmentId }
        _uiState.update { state ->
            state.copy(
                attachments = state.attachments.filter { it.id != attachmentId },
                errorMessage = null
            )
        }

        if (attachmentToRemove != null) {
            viewModelScope.launch {
                storageResolver.deleteLocalAttachmentFile(attachmentToRemove.localUri)
            }
        }
    }

    fun saveAndUploadEntry(uploadRemote: Boolean = true) {
        val currentState = _uiState.value
        if (currentState.title.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Title is required") }
            return
        }

        if (currentState.description.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Description/notes are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isUploading = true,
                    uploadStatus = UploadStatus.UPLOADING,
                    uploadProgress = 0.2f,
                    errorMessage = null
                )
            }

            val result = repository.saveVaultItem(
                title = currentState.title,
                description = currentState.description,
                attachments = currentState.attachments,
                enqueueBackgroundUpload = uploadRemote
            )

            result.fold(
                onSuccess = { savedItem ->
                    _uiState.update {
                        it.copy(
                            isUploading = false,
                            uploadStatus = if (uploadRemote && savedItem.attachments.isNotEmpty()) UploadStatus.UPLOADING else UploadStatus.COMPLETED,
                            uploadProgress = 1.0f,
                            isSuccess = true,
                            savedItem = savedItem,
                            statusMessage = "Vault entry saved successfully!"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isUploading = false,
                            uploadStatus = UploadStatus.FAILED,
                            errorMessage = error.message ?: "Failed to save vault entry"
                        )
                    }
                }
            )
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearStatusMessage() {
        _uiState.update { it.copy(statusMessage = null) }
    }

    fun resetForm() {
        _uiState.update {
            UploadUiState(maxAttachments = it.maxAttachments)
        }
    }

    class Factory(private val application: Application) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(UploadVaultItemViewModel::class.java)) {
                return UploadVaultItemViewModel(application) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
