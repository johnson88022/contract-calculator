// config.js - 增強版配置
window.APP_CONFIG = {
  serverUrl: "",
  debug: true,
  // 添加同步配置
  sync: {
    enabled: true,
    interval: 5000, //5秒同步一次
    onVisibilityChange: true // 頁面可見時同步
  }
};

console.log("配置加載完成 - 雲端同步已啟用");