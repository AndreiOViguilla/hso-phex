const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function(app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      cookieDomainRewrite: "localhost",  // rewrite cookie domain so browser accepts it
      onProxyRes: function(proxyRes) {
        // Allow cookies to pass through the proxy
        const cookies = proxyRes.headers["set-cookie"];
        if (cookies) {
          proxyRes.headers["set-cookie"] = cookies.map(cookie =>
            cookie
              .replace(/Domain=[^;]+;?\s*/i, "")  // remove domain restriction
              .replace(/Secure;?\s*/i, "")          // remove Secure flag for localhost
          );
        }
      },
    })
  );
};
