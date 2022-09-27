let mainConfig = require("./config");

if (mainConfig.autoLogin) {
    console.log("auto-login enabled");

    const config = require("./auto-login");
    const { Builder, Browser, By } = require("selenium-webdriver");
    const axios = require("axios").default;
    const edge = require("selenium-webdriver/edge");
    const fs = require("fs");

    const tencentcloud = require("tencentcloud-sdk-nodejs");
    const OcrClient = tencentcloud.ocr.v20181119.Client;
    const clientConfig = {
        credential: {
            secretId: config.secretId,
            secretKey: config.secretKey,
        },
        region: "ap-shanghai",
        profile: {
            httpProfile: {
                endpoint: "ocr.tencentcloudapi.com",
            },
        },
    };

    const client = new OcrClient(clientConfig);

    exports.checkCookieAvailability = async cookie => {
        const res = (await axios.get("https://kana.byha.top:444", { headers: { "cookie": cookie } })).data;

        return res.indexOf("recentBattle") != -1;
    };

    exports.getCookie = async () => {
        const driver = new Builder()
            .forBrowser(Browser.EDGE)
            .setEdgeOptions(new edge.Options().addArguments(["--headless", "--no-sandbox", "--disable-dev-shm-usage"]))
            .build();

        const jQuery = (await axios.get("https://kana-1252071452.cos.ap-shanghai.myqcloud.com/js/jquery.min.js")).data;

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        while (true) {
            try {
                await driver.get("https://kana.byha.top:444/api/captcha");

                await driver.executeScript(jQuery);

                await driver.findElement(By.css("[fill=none]")).then(async element =>
                    await driver.executeScript("let element = arguments[0];element.parentNode.removeChild(element);", element)
                );

                const base64 = await (await driver.findElement(By.css("svg"))).takeScreenshot();

                const ans = (await client.GeneralBasicOCR({ "ImageBase64": base64 }))
                    .TextDetections[0].DetectedText
                    .replaceAll(/[\(\)]/g, "") // 去除诡异括号
                    .replaceAll(/了/g, "3");

                if (!/^[a-zA-Z\d]{4}$/.exec(ans)) {
                    continue;
                }

                console.log(ans);

                const res = await driver.executeScript(`return (await $.post("/login", "username=${config.username}&pwd=${config.password}&cap=${ans}"))`);

                if (res.status == "success") {
                    break;
                }
            } catch (error) {
                console.log(error);
                await sleep(5000);
            }
        }

        const cookie = "client_session=" + (await driver.manage().getCookie("client_session")).value;

        mainConfig.cookie = cookie;

        fs.writeFileSync("config.json", JSON.stringify(mainConfig));

        return cookie;
    };
} else {
    console.log("auto-login disabled");
    exports.checkCookieAvailability = async _ => true;
}
