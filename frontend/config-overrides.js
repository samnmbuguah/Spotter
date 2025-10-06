const path = require('path');

module.exports = function override(config, env) {
  // Fix util._extend deprecation warning
  config.resolve.fallback = {
    ...config.resolve.fallback,
    util: require.resolve('util/'),
  };

  // Configure proxy for API requests
  if (config.devServer) {
    config.devServer.proxy = {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    };

    // Disable hot reloading WebSocket but keep dev server functional
    config.devServer.hot = false;
    config.devServer.liveReload = false;

    // Configure client to not use WebSocket for hot reloading
    config.devServer.client = {
      webSocketURL: {
        hostname: '0.0.0.0',
        pathname: '/ws',
        port: 3000,
        protocol: 'ws',
      },
      overlay: {
        errors: true,
        warnings: false,
      },
    };
  }

  return config;
};
