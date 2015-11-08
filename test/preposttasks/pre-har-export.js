var webdriver = require('selenium-webdriver');

module.exports = {
  run(context) {
    return context.runWithDriver((driver) => {
      return driver.get('data:text/html;charset=utf-8,')
        .then(() => {
          return driver.executeScript('document.body.style.background = \"#DE640D\"');
        })
        .then(() => {
          return driver.findElement(webdriver.By.tagName('html')).sendKeys(webdriver.Key.F12);
        })
        .then(() => {
          return driver.manage().timeouts().implicitlyWait(1);
        })
        .then(() => {
          return driver.executeScript('document.body.style.background = \"#FFFFFF\"');
        });

    });
  }
};
