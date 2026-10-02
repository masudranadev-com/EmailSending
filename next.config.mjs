/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
    webpackBuildWorker: false,
    workerThreads: false,
  },
};

export default nextConfig;
