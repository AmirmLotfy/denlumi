import { defineConfig } from '@playwright/test';
process.loadEnvFile('.env.local');
export default defineConfig({
 testDir:'./tests/e2e',timeout:45_000,fullyParallel:false,workers:1,retries:0,
 reporter:[['line']],use:{baseURL:'http://127.0.0.1:3400',channel:'chrome',trace:'retain-on-failure',screenshot:'only-on-failure'}
});
