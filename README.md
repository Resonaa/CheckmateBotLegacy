# CheckmateBot

食用方法
- 下载`nodejs`
- 再clone本项目
- 在本项目文件夹下运行`npm i`
- 复制`config_example.json`为`config.json`,并填写其中配置项(主要是最后的cookie)
- 在本目录下运行`npm start`
- 搞定

自动登录

波特会在连接断开时检查cookie可用性,如已过期则自动获取新的cookie并重新连接(会更新配置文件中的cookie)

配置方法:

- 将`config.json`中的autoLogin设为true
- 注册[腾讯云OCR](https://cloud.tencent.com/act/event/ocrdemo)(是免费的),获取secretId和secretKey
- 复制`auto-login_example.json`为`auto-login.json`,并填写其中配置项
- 安装并配置EdgeDriver(别的也行,只不过要自己改代码)