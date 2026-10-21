import {expect,test} from '../frontend/node_modules/@playwright/test';
// The goal is global: exercise both viewport sizes sequentially with one writer.
test('zmiana celu na telefonie 390×844 i laptopie 1440×900',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='telefon','Oba viewporty są sprawdzane kolejno w jednym teście globalnego celu.');
  const original=await(await request.get('/api/goal')).json();
  try{
    for(const desktop of [false,true]){
      await page.setViewportSize(desktop?{width:1440,height:900}:{width:390,height:844});
      await page.goto('/planer');
      const summary=page.getByRole('region',{name:'Podsumowanie dnia',exact:true});
      await expect(summary.getByRole('progressbar')).toHaveCount(4);
      await summary.getByRole('button',{name:desktop?'Zmień cel dzienny':'Zmień cel',exact:true}).click();
      const editor=desktop?summary:page.getByRole('dialog',{name:'Dzienne zapotrzebowanie'});
      for(const [label,value] of [['Kalorie (kcal)',desktop?'2100':'1800'],['Białko (g)',desktop?'130':'120'],['Węglowodany (g)',desktop?'260':'240'],['Tłuszcze (g)',desktop?'70':'0']]){
        const response=page.waitForResponse(r=>r.url().endsWith('/api/goal')&&r.request().method()==='PUT');
        await editor.getByLabel(label,{exact:true}).fill(value);
        expect((await response).status()).toBe(200);
      }
      if(desktop)await summary.getByRole('button',{name:'Ukryj edycję celu'}).click();else await editor.getByRole('button',{name:'Gotowe'}).click();
      await expect(summary.getByRole('group',{name:'Tłuszcze',exact:true}).getByText(desktop?'70 g':'brak celu')).toBeVisible();
      expect(await(await request.get('/api/goal')).json()).toEqual({kcal:desktop?2100:1800,protein:desktop?130:120,carbs:desktop?260:240,fat:desktop?70:0});
      await page.reload();
      await summary.getByRole('button',{name:desktop?'Zmień cel dzienny':'Zmień cel',exact:true}).click();
      const reloaded=desktop?summary:page.getByRole('dialog',{name:'Dzienne zapotrzebowanie'});
      await expect(reloaded.getByLabel('Kalorie (kcal)')).toHaveValue(desktop?'2100':'1800');
      await expect(reloaded.getByLabel('Tłuszcze (g)')).toHaveValue(desktop?'70':'0');
      if(desktop)await summary.getByRole('button',{name:'Ukryj edycję celu'}).click();else await reloaded.getByRole('button',{name:'Gotowe'}).click();
    }
  }finally{await request.put('/api/goal',{data:original});}
});
