// WattsUp Coach – Machbarkeitstest für den Karoo 2.
// Wird im GitHub-Ablauf in das Projekt hammerheadnav/karoo-ext eingesetzt (als Modul :app),
// damit die Bibliothek ohne GitHub-Packages-Zugang aus dem Quelltext gebaut wird.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    alias(libs.plugins.jetbrains.kotlin.serialization)
}

android {
    namespace = "at.christophschmid.wattsup.coach"
    compileSdk = 35

    defaultConfig {
        applicationId = "at.christophschmid.wattsup.coach"
        minSdk = 23
        targetSdk = 34
        versionCode = (System.getenv("VCODE") ?: "1").toInt()
        versionName = "0.1." + (System.getenv("VCODE") ?: "1")
        buildConfigField("String", "WORKER", "\"" + (System.getenv("WORKER_URL") ?: "") + "\"")
        buildConfigField("String", "REL", "\"https://github.com/christophschmid-design/wattsup/releases/download/karoo/\"")
    }

    signingConfigs {
        create("wu") {
            storeFile = file(System.getenv("KS_FILE") ?: "wattsup.jks")
            storePassword = System.getenv("KS_PASS")
            keyAlias = "wattsup"
            keyPassword = System.getenv("KS_PASS")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("wu")
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation(project(":lib"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.timber)
}
