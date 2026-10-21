import { defineConfig } from '@playwright/test';
// The isolated voice harness supplies local DB/Auth and fictional AWS settings.
// Do not reintroduce provider credentials from dotenv into that runner.
if(process.env.DENLUMI_MOCKED_VOICE!=='1')process.loadEnvFile('.env.local');
export default defineConfig({
 testDir:'./tests/e2e',timeout:45_000,fullyParallel:false,workers:1,retries:0,
 reporter:[['line']],use:{baseURL:'http://127.0.0.1:3400',channel:'chrome',trace:'retain-on-failure',screenshot:'only-on-failure'}
});
