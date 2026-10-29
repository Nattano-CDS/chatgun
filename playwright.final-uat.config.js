import {defineConfig} from '@playwright/test';
if(process.env.CHATGUN_ISOLATED_STAGING!=='final-uat'||!process.env.CHATGUN_FULL_SYSTEM_BUNDLE)throw Error('Dedicated UAT synthetic manifest required');
export default defineConfig({testDir:'e2e',testMatch:'final-uat-synthetic.spec.js',workers:1,retries:0,timeout:180000,expect:{timeout:20000},reporter:[['list'],['json',{outputFile:'docs/final-uat/full-system-cloud-browser.json'}]],use:{baseURL:'https://engineering.chatgun-final-uat.pages.dev',trace:'off',video:'off',screenshot:'only-on-failure'},outputDir:'test-results/final-uat'});
