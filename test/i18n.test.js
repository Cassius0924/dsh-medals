import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n,dictionaries,normalizeLocale} from '../src/i18n.js';
import {CHALLENGES} from '../src/challenges.js';
import {readFile} from 'node:fs/promises';

test('Chinese and English cover every static, dynamic and accessibility translation',async()=>{
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  for(const [,key] of html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)){
    for(const language of ['zh','en'])assert(dictionaries[language][key],`${language}: ${key}`);
  }
  for(const [key,value] of Object.entries(dictionaries.zh)){
    assert(dictionaries.en[key],`missing English translation: ${key}`);
    assert.deepEqual([...value.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),[...dictionaries.en[key].matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort(),`interpolation mismatch: ${key}`);
  }
  for(const value of Object.values(dictionaries.en))assert.doesNotMatch(value,/\p{Script=Han}/u);
});

test('all 22 medal names translate without changing their identity or thresholds',()=>{
  const en=createI18n('en-GB'),zh=createI18n('zh-CN');
  for(const rule of CHALLENGES){
    assert.equal(zh.medalName(rule),rule.name);
    assert.doesNotMatch(en.medalName(rule),/\p{Script=Han}/u);
  }
  assert.equal(en.medalName(CHALLENGES.find(r=>r.id==='volume-week')),'Stellar Orbit');
  assert.equal(en.medalName(CHALLENGES.find(r=>r.id==='tokens-500M')),'Endless Voyage');
  assert.equal(normalizeLocale('zh-Hans'),'zh');
  assert.equal(normalizeLocale('de-DE'),'en');
});

test('calendar dates never shift timezone and interpolation preserves zero values',()=>{
  const i18n=createI18n('en');
  assert.equal(i18n.date('2026-10-23'),'Oct 23, 2026');
  assert.equal(i18n.date('lifetime'),'lifetime');
  assert.equal(i18n.number(1200),'1,200');
  assert.equal(i18n.t('revealCount',{count:0}),'Reveal new medals · 0');
  i18n.setLocale('zh');assert.equal(i18n.date('2026-10-23'),'2026-10-23');
  assert.equal(i18n.t('revealCount',{count:0}),'揭晓新奖牌 · 0');
});
