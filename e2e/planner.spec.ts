import {expect,test} from '../frontend/node_modules/@playwright/test';

test('planer: dodawanie, zastępowanie, trwałość, zakupy, szczegóły i usuwanie', async ({page,request},testInfo)=>{
  const desktop=testInfo.project.name==='laptop';
  const week=desktop?'2027-01-04':'2026-12-28';
  const day=desktop?'2027-01-05':'2026-12-29';
  const dayAria=desktop?'Wtorek 5 stycznia':'Wtorek 29 grudnia';
  const dayHeading=desktop?'Wtorek, 5 stycznia':'Wtorek, 29 grudnia';
  const saved=[];
  for(let i=0;i<2;i++){
    const response=await request.post('/api/recipes',{data:{title:`Planer ${i} ${crypto.randomUUID()}`,category:'obiad',servings:2,time_min:25,kcal:330,protein:10,carbs:20,fat:5,steps:['Ugotuj']}});
    expect(response.status()).toBe(201);saved.push(await response.json());
  }
  try{
    await page.clock.install({time:new Date('2026-10-21T10:00:00Z')});
    await page.goto('/planer');
    await expect(page.getByText('19–25 października · 0 z 21 posiłków')).toBeVisible();
    await expect(page.getByText('Dziś',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Następny tydzień'}).click();
    await expect(page.getByText('Dziś',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Poprzedni tydzień'}).click();
    await expect(page.getByText('Dziś',{exact:true})).toBeVisible();
    await page.goto(`/planer?week=${week}`);
    await expect(page.getByText(desktop?'4–10 stycznia · 0 z 21 posiłków':'28 grudnia 2026 – 3 stycznia 2027 · 0 z 21 posiłków')).toBeVisible();
    const shopping=page.getByRole('main').getByRole('button',{name:/Lista zakupów/});
    await expect(shopping).toBeDisabled();
    await page.getByRole('button',{name:dayAria,exact:true}).click();
    await expect(page.getByRole('heading',{name:dayHeading,exact:true})).toBeVisible();
    const target=desktop?page.getByRole('group',{name:dayHeading,exact:true}).getByRole('group',{name:'Obiad',exact:true}):page.getByRole('group',{name:'Obiad',exact:true});
    await target.getByRole('button',{name:'Dodaj przepis: Obiad',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'Wybierz przepis'});
    await expect(picker.getByText('Wtorek · Obiad')).toBeVisible();
    const choices=picker.getByRole('button',{name:/^Wybierz:/});
    const first=await choices.nth(0).boundingBox();
    const second=await choices.nth(1).boundingBox();
    expect(first).not.toBeNull();expect(second).not.toBeNull();
    if(desktop){expect(second!.x).toBeGreaterThan(first!.x);}else{expect(second!.y).toBeGreaterThan(first!.y);}
    await picker.getByRole('button',{name:`Wybierz: ${saved[0].title}`,exact:true}).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('status').filter({hasText:`Dodano do planera: ${saved[0].title}`})).toBeVisible();
    await expect(target.getByRole('button',{name:`Otwórz przepis: ${saved[0].title}`,exact:true})).toBeVisible();
    if(desktop) expect(Math.round((await target.boundingBox())!.height)).toBe(148);
    expect(await (await request.get(`/api/plan?week=${week}`)).json()).toEqual([{date:day,slot:1,recipe_id:saved[0].id}]);
    await page.reload();
    await page.getByRole('button',{name:dayAria,exact:true}).click();
    await expect(target.getByRole('button',{name:`Otwórz przepis: ${saved[0].title}`,exact:true})).toBeVisible();
    await target.getByRole('button',{name:'Dodaj przepis: Obiad',exact:true}).click();
    await expect(picker.getByText(`Zastąpi: ${saved[0].title}`,{exact:true})).toBeVisible();
    await picker.getByRole('button',{name:`Wybierz: ${saved[1].title}`,exact:true}).click();
    await expect(picker).toHaveCount(0);
    expect(await (await request.get(`/api/plan?week=${week}`)).json()).toEqual([{date:day,slot:1,recipe_id:saved[1].id}]);
    await shopping.click();
    await expect(page).toHaveURL(`/zakupy?week=${week}`);
    await page.goBack();
    await expect(page).toHaveURL(`/planer?week=${week}`);
    await page.getByRole('button',{name:dayAria,exact:true}).click();
    await target.getByRole('button',{name:`Otwórz przepis: ${saved[1].title}`,exact:true}).click();
    await expect(page).toHaveURL(`/przepis/${saved[1].id}`);
    await expect(page.getByRole('heading',{name:saved[1].title,exact:true})).toBeVisible();
    if(desktop) expect(Math.round((await page.getByRole('complementary',{name:'Szczegóły przepisu'}).boundingBox())!.width)).toBe(480);
    await page.goBack();
    await page.getByRole('button',{name:dayAria,exact:true}).click();
    const deleted=page.waitForResponse(response=>response.url().endsWith(`/api/plan/${day}/1`)&&response.request().method()==='DELETE');
    await target.getByRole('button',{name:`Usuń z planera: ${saved[1].title}`,exact:true}).click();
    expect((await deleted).status()).toBe(204);
    await expect(target.getByRole('button',{name:`Otwórz przepis: ${saved[1].title}`,exact:true})).toHaveCount(0);
    await expect(target.getByRole('button',{name:'Dodaj przepis: Obiad',exact:true})).toBeVisible();
    await expect(shopping).toBeDisabled();
    expect(await (await request.get(`/api/plan?week=${week}`)).json()).toEqual([]);
  }finally{
    await request.delete(`/api/plan/${day}/1`);
    for(const recipe of saved) await request.delete(`/api/recipes/${recipe.id}`);
  }
});
