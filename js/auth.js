window.SGV = window.SGV || {};
(function (S) {
  'use strict';
  var C = window.APP_CONFIG;
  var SCOPES = ['User.Read', 'User.ReadBasic.All', 'Sites.ReadWrite.All'];
  var app = null, account = null;

  S.Auth = {
    configured: function () { return !/DIEN-/.test(C.clientId) && !/DIEN-/.test(C.tenantId); },

    // Trả về tài khoản đã đăng nhập, hoặc null nếu cần đăng nhập
    async start() {
      app = new msal.PublicClientApplication({
        auth: {
          clientId: C.clientId,
          authority: 'https://login.microsoftonline.com/' + C.tenantId,
          redirectUri: C.redirectUri || (location.origin + location.pathname.replace(/index\.html$/, ''))
        },
        cache: { cacheLocation: 'localStorage' }
      });
      await app.initialize();
      var res = await app.handleRedirectPromise();
      if (res && res.account) account = res.account;
      if (!account) { var all = app.getAllAccounts(); if (all.length) account = all[0]; }
      if (account) app.setActiveAccount(account);
      return account;
    },
    login: function () { return app.loginRedirect({ scopes: SCOPES }); },
    logout: function () { return app.logoutRedirect({ account: account }); },
    account: function () { return account; },
    async token() {
      try {
        var r = await app.acquireTokenSilent({ scopes: SCOPES, account: account });
        return r.accessToken;
      } catch (e) {
        await app.acquireTokenRedirect({ scopes: SCOPES, account: account });
        return new Promise(function () { /* trang sẽ chuyển hướng */ });
      }
    }
  };
})(window.SGV);
