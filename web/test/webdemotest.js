// import Page from './basic-page-model';
import { Selector } from 'testcafe';


fixture `CPIC Demo`
    .page `http://localhost:8083`;

// const page = new Page();
const settingIcon        = Selector('#settingicon')
const patientOne        = Selector('input[type=radio][value="0"]+label');
const recList = Selector('#reclist')

test('Gene Panel', async t => {
    const diplotypeExists   = Selector('#CYP2D6').exists;
    await t
      .expect(diplotypeExists).ok();
});

test('Setting', async t => {
    await t
      .click(settingIcon)
      .wait(1000);

    const defaultRadioButton = Selector('input[type=radio][value="default"]+span')
    const settingModal       = Selector('#setting')
    const okbutton           = Selector('button.btn-primary')

    await t
      .click(defaultRadioButton)
      .wait(1000)
      .click(okbutton)
      .wait(1000)
      .expect(settingModal.getStyleProperty('display')).eql('none');


});
