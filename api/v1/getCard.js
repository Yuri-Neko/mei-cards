const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const getRecordCard = require('../../lib/hoyo/getRecordCard');
const gameConfig = require('../../lib/hoyo/gameConfig.json');

module.exports = async function handler(req, res) {
  try {
    // do card
    let { game } = req.query;
    if (!game) {
      return res.status(400).json({ success: false, error: 'Missing game' });
    }
    if (game != 'genshin' && game != 'honkai3rd' && game != 'starrail') {
      return res.status(400).json({ success: false, error: 'Invalid game' });
    }

    // get game config form name
    let gameConfigData = gameConfig.find((gameConfig) => gameConfig.code_name == game);

    let hoyolabRecordCard = await getRecordCard(gameConfigData.code);
    if (!hoyolabRecordCard.success) {
      return res.status(400).json({ success: false, error: 'Failed to get data from HoYoLab' });
    }

    try {
      // load fonts
      GlobalFonts.registerFromPath(path.join(__dirname, '../', '../', 'lib', 'fonts', 'NSB.ttf'), "Noto Sans Bold");
      GlobalFonts.registerFromPath(path.join(__dirname, '../', '../', 'lib', 'fonts', 'NSR.ttf'), "Noto Sans Regular");

      // make canvas
      const cardCanvas = createCanvas(2400, 1200);
      const cardCTX = cardCanvas.getContext('2d');

      // load background based on game
      let gameBackground = await loadImage(fs.readFileSync(path.join(__dirname, '../', '../', 'lib', 'hoyo', 'images', `${game}.jpg`)));
      cardCTX.drawImage(gameBackground, 0, 0, 2400, 1200);

      // make a "dark" overlay
      cardCTX.fillStyle = 'rgba(0, 0, 0, 0.5)';
      cardCTX.fillRect(0, 0, 2400, 1200);

      cardCTX.fillStyle = '#ffffff';

      // draw game name
      cardCTX.font = '75px "Noto Sans Bold"';
      cardCTX.fillText(gameConfigData.name, 75, 175);

      // draw level and uid
      cardCTX.font = '30px "Noto Sans Regular"';
      cardCTX.fillText(`Level ${hoyolabRecordCard.hoyolabRecordCard.level} - UID ${hoyolabRecordCard.hoyolabRecordCard.game_role_id} [${hoyolabRecordCard.hoyolabRecordCard.region_name}]`, 90, 222);

      // draw extra data stuff; days active, achievements...
      let extraDataStuffConfig = {
        titleFont: "50px \"Noto Sans Bold\"",
        subtitleFont: "30px \"Noto Sans Regular\"",
        titleHeight: 310,
        subtitleHeight: 360,
        zeroWidth: 75,
        oneWidth: 500
      }
      switch (game) {
        case "honkai3rd":
          extraDataStuffConfig["oneWidth"] = 600;
          break;
        case "starrail":
          extraDataStuffConfig["oneWidth"] = 700;
          break;
      }

      // days
      cardCTX.font = extraDataStuffConfig["titleFont"];
      cardCTX.fillText(hoyolabRecordCard.hoyolabRecordCard.data[0].name, extraDataStuffConfig["zeroWidth"], extraDataStuffConfig["titleHeight"]);
      cardCTX.font = extraDataStuffConfig["subtitleFont"];
      cardCTX.fillText(`${hoyolabRecordCard.hoyolabRecordCard.data[0].value} Days`, extraDataStuffConfig["zeroWidth"], extraDataStuffConfig["subtitleHeight"]);

      // characters
      cardCTX.font = extraDataStuffConfig["titleFont"];
      cardCTX.fillText(hoyolabRecordCard.hoyolabRecordCard.data[1].name, extraDataStuffConfig["oneWidth"], extraDataStuffConfig["titleHeight"]);
      cardCTX.font = extraDataStuffConfig["subtitleFont"];
      cardCTX.fillText(`${hoyolabRecordCard.hoyolabRecordCard.data[1].value} ${hoyolabRecordCard.hoyolabRecordCard.data[1].name.includes(" ") ? hoyolabRecordCard.hoyolabRecordCard.data[1].name.split(" ")[0] : hoyolabRecordCard.hoyolabRecordCard.data[1].name} Unlocked`, extraDataStuffConfig["oneWidth"], extraDataStuffConfig["subtitleHeight"]);

      // achievements / battlesuits (genshin, hsr have achievements, honkai3rd has battlesuits)
      cardCTX.font = extraDataStuffConfig["titleFont"];
      cardCTX.fillText(hoyolabRecordCard.hoyolabRecordCard.data[2].name, extraDataStuffConfig["zeroWidth"], extraDataStuffConfig["titleHeight"] + 150);
      cardCTX.font = extraDataStuffConfig["subtitleFont"];
      cardCTX.fillText(`${hoyolabRecordCard.hoyolabRecordCard.data[2].value} ${hoyolabRecordCard.hoyolabRecordCard.data[2].name.includes(" ") ? hoyolabRecordCard.hoyolabRecordCard.data[2].name.split(" ")[0] : hoyolabRecordCard.hoyolabRecordCard.data[2].name} Unlocked`, extraDataStuffConfig["zeroWidth"], extraDataStuffConfig["subtitleHeight"] + 150);

      // outfits, treasures, spiral abyss (hi3, hsr, genshin)
      cardCTX.font = extraDataStuffConfig["titleFont"];
      cardCTX.fillText(hoyolabRecordCard.hoyolabRecordCard.data[3].name, extraDataStuffConfig["oneWidth"], extraDataStuffConfig["titleHeight"] + 150);
      cardCTX.font = extraDataStuffConfig["subtitleFont"];
      cardCTX.fillText(`${game !== "genshin" ? "" : "Floor "}${hoyolabRecordCard.hoyolabRecordCard.data[3].value}${game !== "genshin" ? hoyolabRecordCard.hoyolabRecordCard.data[3].name.includes(" ") ? ` ${hoyolabRecordCard.hoyolabRecordCard.data[3].name.split(" ")[0]}` : ` ${hoyolabRecordCard.hoyolabRecordCard.data[3].name}` : ""}${game !== "honkai3rd" ? " Unlocked" : " Owned"}`, extraDataStuffConfig["oneWidth"], extraDataStuffConfig["subtitleHeight"] + 150);

      // send to client
      res.setHeader('Cache-Control', 'public, max-age 432000, stale-while-revalidate 86400');
      res.setHeader('Content-Type', 'image/png');
      return res.status(200).send(await cardCanvas.toBuffer('image/png'));
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, error: 'Failed to make card' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
