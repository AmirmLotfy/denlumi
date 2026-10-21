import { expect,test } from './database-test';

test('fictional private report stays on the local origin and out of browser console output',async({page})=>{
 const origin='http://127.0.0.1:3400',marker='FICTIONAL_PRIVATE_NETWORK_AUDIT_923';
 const external:string[]=[],urlLeaks:string[]=[],consoleLeaks:string[]=[];
 page.on('request',request=>{const url=request.url();if(new URL(url).origin!==origin)external.push(url);if(url.includes(marker))urlLeaks.push(url);});
 page.on('console',message=>{if(message.text().includes(marker))consoleLeaks.push(message.type());});
 page.on('pageerror',error=>{if(error.message.includes(marker))consoleLeaks.push('pageerror');});
 await page.goto('/');
 await page.route('**/api/caregiver',async route=>{if(route.request().method()==='GET')await new Promise(resolve=>setTimeout(resolve,600));await route.continue();});
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await page.getByLabel('The exact fictional report').fill(marker);
 await page.getByLabel('Who was observed?').selectOption({label:'Finn (dog)'});
 await page.getByLabel('How is it reported?').selectOption('uncertain');
 await expect(page.getByRole('button',{name:'Check Sam’s saved view'})).toBeEnabled();
 await expect(page.getByLabel('The exact fictional report')).toHaveValue(marker);
 await page.getByRole('button',{name:'Save fictional observation'}).click();
 await expect(page.getByText(marker)).toBeVisible();
 await page.reload();
 await expect(page.getByText(marker)).toBeVisible();
 expect(external).toEqual([]);expect(urlLeaks).toEqual([]);expect(consoleLeaks).toEqual([]);
});
