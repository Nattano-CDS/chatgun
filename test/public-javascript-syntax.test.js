import test from 'node:test';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('all deployable root and app JavaScript parses before release',()=>{
  for(const directory of ['.','app'])for(const entry of readdirSync(directory,{withFileTypes:true})){
    if(entry.isFile()&&entry.name.endsWith('.js'))execFileSync(process.execPath,['--check',resolve(directory,entry.name)],{stdio:'pipe'});
  }
});
