import { test, expect } from '@playwright/test';
import type { PlatformSnapshot } from '../../src/domain/types';
import { deserializeSnapshot } from '../../src/adapters/mock/snapshotStorage';

test('archives and restores an isolated draft without losing imports, history or other campaigns', async ({ page }) => {
  const errors:string[]=[];
  const unexpected:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!['127.0.0.1','localhost'].includes(url.hostname)||route.request().method()!=='GET') {
      unexpected.push(route.request().method()+' '+url.origin+url.pathname); return route.abort();
    }
    return route.continue();
  });
  await page.goto('/campaigns');
  const {campaign,original}=await page.evaluate(async()=>{
    const modulePath='/src/adapters/mock/seed.ts';
    const {seedSnapshot,IDS}=await import(modulePath);
    const snapshot=structuredClone(seedSnapshot) as PlatformSnapshot;
    const campaign=snapshot.campaigns.find(c=>c.id===IDS.octoberCampaign)!;
    campaign.status='draft';
    snapshot.campaignReleases=snapshot.campaignReleases.filter(r=>r.campaignId!==campaign.id);
    Object.assign(snapshot,{__blackBettyStorage:{schemaVersion:1}});
    localStorage.setItem('cascadia-merchandising-platform-v1',JSON.stringify(snapshot));
    return {campaign:{id:campaign.id,name:campaign.name},original:snapshot};
  });
  await page.goto(`/campaigns/${campaign.id}`);
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain(campaign.id);await dialog.accept();});
  await page.getByRole('button',{name:'Archive draft'}).click();
  await expect(page.getByRole('button',{name:'Restore to draft'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Restore to draft'})).toBeVisible();
  const archived=deserializeSnapshot(await page.evaluate(()=>localStorage.getItem('cascadia-merchandising-platform-v1')!));
  const expected=structuredClone(original); expected.campaigns.find(c=>c.id===campaign.id)!.status='archived';
  expect(archived).toEqual(expected);
  await page.goto('/campaigns');
  await expect(page.getByRole('link',{name:campaign.name,exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Show archived campaigns'}).check();
  await page.getByRole('link',{name:campaign.name,exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Restore to draft'}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Archive draft'})).toBeVisible();
  const restored=deserializeSnapshot(await page.evaluate(()=>localStorage.getItem('cascadia-merchandising-platform-v1')!));
  expect(restored).toEqual(original);
  expect(errors).toEqual([]);expect(unexpected).toEqual([]);
});
