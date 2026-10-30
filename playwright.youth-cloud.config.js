import {defineConfig} from '@playwright/test';
if(process.env.CHATGUN_ISOLATED_STAGING!=='issue13')throw Error('Explicit isolated synthetic staging acknowledgement required');
export default defineConfig({testDir:'e2e',testMatch:'youth-cloud.spec.js',workers:1,retries:0,timeout:90000,
 expect:{timeout:15000},reporter:[['list'],['json',{outputFile:'test-results/youth-cloud-browser.json'}]],
 use:{baseURL:'https://issue13.chatgun-issue13-staging.pages.dev',trace:'off',video:'off',screenshot:'only-on-failure'},
 outputDir:'test-results/youth-cloud-artifacts'});
