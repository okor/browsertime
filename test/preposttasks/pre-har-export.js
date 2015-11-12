var webdriver = require('selenium-webdriver');

module.exports = {
  run(context) {
    return context.runWithDriver((driver) => {
      return driver.get('data:text/html;charset=utf-8,')
        .then(() => {
          return driver.executeScript('document.body.style.background = \"#DE640D\"');
        })
        .then(() => {
          driver.manage().timeouts().implicitlyWait(5);
        })
        .then(() => {
          driver.manage().timeouts().implicitlyWait(5);
          return driver.executeScript('document.body.style.background = \"#FFFFFF\"');
        })
    });
  }
};
