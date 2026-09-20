package com.gizmovault.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.gizmovault.app.ui.UploadVaultItemScreen
import com.gizmovault.app.ui.UploadVaultItemViewModel
import com.gizmovault.app.ui.WhatsAppCatalogSyncScreen
import com.gizmovault.app.ui.theme.GizmoVaultTheme

class UploadVaultItemActivity : ComponentActivity() {

    private val viewModel: UploadVaultItemViewModel by viewModels {
        UploadVaultItemViewModel.Factory(application)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            GizmoVaultTheme {
                var selectedTab by remember { mutableStateOf(0) }

                Scaffold(
                    bottomBar = {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surface
                        ) {
                            NavigationBarItem(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                icon = { Icon(Icons.Default.CloudUpload, contentDescription = "Upload Entry") },
                                label = { Text("Manual Entry") }
                            )
                            NavigationBarItem(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                icon = { Icon(Icons.Default.Sync, contentDescription = "WhatsApp Ingest") },
                                label = { Text("WhatsApp Sync") }
                            )
                        }
                    }
                ) { innerPadding ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        if (selectedTab == 0) {
                            UploadVaultItemScreen(
                                viewModel = viewModel,
                                onNavigateBack = { finish() }
                            )
                        } else {
                            WhatsAppCatalogSyncScreen(
                                onNavigateBack = { selectedTab = 0 }
                            )
                        }
                    }
                }
            }
        }
    }
}
