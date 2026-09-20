package com.gizmovault.app.network

import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import java.util.concurrent.TimeUnit

data class IngestProductPayload(
    val raw_text: String,
    val merchant_id: String,
    val timestamp: Long = System.currentTimeMillis(),
    val original_file_id: String,
    val tags: List<String> = emptyList()
)

data class ShopifyProductMediaDto(
    val url: String,
    val media_type: String,
    val position: Int
)

data class ShopifyProductDto(
    val id: String,
    val merchant_id: String,
    val title: String,
    val description_html: String,
    val status: String,
    val category: String,
    val price: Double,
    val currency: String,
    val media: List<ShopifyProductMediaDto> = emptyList(),
    val created_at: String? = null
)

data class IngestProductResponse(
    val success: Boolean,
    val product: ShopifyProductDto?,
    val error: String? = null
)

interface CatalogIngestionApi {

    @Multipart
    @POST("api/v1/admin/ingest-product")
    suspend fun ingestProduct(
        @Part file: MultipartBody.Part,
        @Part("payload") payload: RequestBody
    ): Response<IngestProductResponse>

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:4000/"

        fun create(baseUrl: String = DEFAULT_BASE_URL): CatalogIngestionApi {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .build()

            return Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(CatalogIngestionApi::class.java)
        }
    }
}
