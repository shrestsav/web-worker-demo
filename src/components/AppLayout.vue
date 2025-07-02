<script setup>
// No additional script needed for basic layout
</script>

<template>
    <div class="app-container">
        <header class="bg-gray-800 text-white shadow-sm">
            <div
                class="max-w-screen-2xl mx-auto"
                style="width: 1000px"
            >
                <nav class="flex items-center h-14">
                    <h1 class="text-xl font-medium ml-6 mr-8" style="color: white">
                        WEB WORKER DEMO
                    </h1>
                    <div class="flex">
                        <router-link
                            to="/worker-lifecycle"
                            class="nav-link"
                            active-class="nav-link-active"
                        >
                            Worker Lifecycle
                        </router-link>
                        <router-link
                            to="/with-web-worker"
                            class="nav-link"
                            active-class="nav-link-active"
                        >
                            With Web Worker
                        </router-link>
                        <router-link
                            to="/without-web-worker"
                            class="nav-link"
                            active-class="nav-link-active"
                        >
                            Without Web Worker
                        </router-link>
                        <router-link
                            to="/"
                            class="nav-link"
                            active-class="nav-link-active"
                        >
                            PSD Viewer
                        </router-link>
                        <router-link
                            to="/psd-viewer"
                            class="nav-link"
                            active-class="nav-link-active"
                        >
                            PSD Viewer (Web Worker)
                        </router-link>
                    </div>
                </nav>
            </div>
        </header>

        <main class="w-full py-6">
            <router-view></router-view>
        </main>
    </div>
</template>

<style scoped>
.app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

main {
    flex: 1;
}

.nav-link {
    display: inline-block;
    padding: 0 1.25rem;
    line-height: 3.5rem;
    height: 3.5rem;
    color: #e2e8f0;
    font-weight: 500;
    position: relative;
    transition: color 0.2s ease;
}

.nav-link:hover {
    color: white;
}

.nav-link-active {
    color: white;
}

p {
    color: black;
}

.nav-link-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #3b82f6;
}
</style>
