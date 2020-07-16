const mosca = require('mosca');
const query = require('./mysql.config');
const axios = require('axios');
const fs = require('fs');
const HashMap = require('hashmap');
const log4js = require('log4js');
const log = log4js.getLogger('mqtt-broker');
const VistorCheck = require('../service/VisitorCheck/index');
const settings = {
    port: 61613
};

const subscribed_client = [];
const message_id_map = new HashMap();

const FILE_PATH = process.env.NODE_ENV === 'dev' ? '/www/wwwroot/fcity/public/uploads/rec_imgs/' : '/www/wwwroot/47.103.39.44/public/uploads/rec_imgs/';
const CDN_URL_DOMAIN = process.env.NODE_ENV === 'dev' ? 'http://47.116.75.164/uploads/rec_imgs/' : 'http://47.103.39.44/uploads/rec_imgs/';
const CDN_URL = '/uploads/rec_imgs/';

const server = new mosca.Server(settings);
server.on('ready', () => {
    log.info('mqtt broker is ready and running on port: ', settings.port);
});

server.on('clientConnected', (client) => {
    log.info('client connected:', client.id);
});

server.on('subscribed', (topic) => {		//订阅
    log.info('subscribed: ', topic);
    subscribed_client.push(topic);
});
server.on('unSubscribed', (topic, client) => {  	//取消订阅
    log.info('unSubscribed: ', topic);
});

server.on('clientDisConnected', (client) => {
    log.info('client disconnected', client.id);
});
// 接收到消息
server.on('published', async (packet, client) => {
    const { topic, payload } = packet;

    log.info(`topic=${topic}, payload=${payload.toString().slice(1000)}`);

    const messageJson = JSON.parse(payload);
    log.info('message json: ', messageJson);

    if(topic.substr(-3) === 'Ack') {
        clearTimeout(message_id_map.get(messageJson.messageId));
        message_id_map.delete(messageJson.messageId);
        log.info('result is ', messageJson.info.result);
        switch(messageJson.info.result) {
            case 'ok':
                try {
                    log.info('Ack ok ', messageJson.messageId);
                    query(`UPDATE fa_device_operate_log SET status = '30' WHERE message_id ='${messageJson.messageId}'`);
                } catch(e) {
                    log.error(e);
                }
                break;
            case 'fail':
                try {
                    log.info('Ack fail ', messageJson.messageId);
                    query(`UPDATE fa_device_operate_log SET max_send_count=max_send_count+1 WHERE message_id = '${messageJson.messageId}'`);
                } catch (e) {
                    log.error(e);
                }
                break;
            default:
                log.error(`messageJson.info.result not ok or fail, is ${messageJson.info.result}`);
                break;
        }
    } else if(topic.substr(-3) === 'Rec') { // 接收到设备的上报消息
        if(messageJson.operator === 'RecPush') {
            const { facesluiceId, customId, temperature } = messageJson.info;

            if(messageJson.info.pic) {
                const base64Data = messageJson.info.pic.replace(/^data:image\/\w+;base64,/, '');
                const dataBuffer = Buffer.from(base64Data, 'base64');
                const now = Math.round(new Date().getTime() / 1000);
                const fileName = `${facesluiceId}-${customId}-${now}.jpg`;
                if(customId !== '' && customId !== null && customId !== undefined) {
                    // 图片存起来
                    fs.writeFile(FILE_PATH + fileName, dataBuffer, (err) => {
                        if(err) {
                            log.error(err);
                            return;
                        }
                        log.info(`${fileName} save success!`);
                    });
                    try {
                        query(`INSERT INTO fa_record_lst (device_key,employee_id,recognize_photo_url,createtime,updatetime,status) VALUES (?,?,?,?,?,?)`,
                            [facesluiceId, customId, CDN_URL + fileName, now, now, 'normal']
                        )
                    } catch(e) {
                        log.error(e);
                        return;
                    }

                    //=================收到人脸识别信息上报云平台=====================
                    const postData = {
                        "callback_tag": "OK",
                        "data":{
                            "is_auth": "yes",
                            "member_id": customId,
                            "device_id": facesluiceId,
                            "recognize_time": now,
                            "recognize_photo_url": CDN_URL_DOMAIN + fileName,
                            "member_type": 1,
                            "safety_hat_wear": 1,
                            "safety_hat_type": "1",
                            "mask_worn_flag": true,
                            "temperature": temperature
                        }
                    };

                    // const callbackUrl = "http://test-facegate-api.huariot.com/api/v1/ifc_device_callback/";
                    const auth_key_sql = 'SELECT pl.prj_auth_key FROM `fa_employee_group_access` ega join `fa_proj_group` pg on ega.group_id=pg.id join `fa_proj_lst` pl on pg.project_id = pl.id WHERE ega.employee_id = '+ postData.data.member_id;

                    if(customId) {
                        try {
                            const results = await query(auth_key_sql);
                            log.info('auth_key_sql result is: ', JSON.stringify(results));
                            results.forEach((item) => {
                                query(`SELECT callback_url from fa_company_callback WHERE prj_auth_key = '${item.prj_auth_key}'`, null, (err, res) => {
                                    if(err) {
                                        log.error(err.message);
                                        return;
                                    } else {
                                        log.info('----prepare to send data----');
                                        res.forEach((v) => {
                                            log.info('send data is :', JSON.stringify(v));
                                            axios.post(v.callback_url, {
                                                'method': 'post',
                                                'headers': {
                                                    "content-type": "application/json",
                                                },
                                                'data': postData,
                                                'withCredentials': true
                                            })
                                        });
                                    }
                                });
                            });
                        } catch (e) {
                            log.error(e);
                            return;
                        }
                    }
                }
            }
        }
    } else if(topic.substr(-14) === 'new/subscribes') {
        try {
            query(`UPDATE fa_device_info SET online_status = 1 WHERE device_key = '${messageJson.clientId}'`);
        } catch(e) {
            log.error(e);
        }
    } else if(topic.substr(-16) === 'new/unsubscribes') {
        try {
            query(`UPDATE fa_device_info SET online_status = 0 WHERE device_key = '${messageJson.clientId}'`);
        } catch (e) {
            log.error(e);
        }
    }
});

async function sendDataToDevice(deviceId, messageId, content) {
    let contentJson = JSON.parse(content);
    if(contentJson.operator === 'EditPerson') {
        log.info(contentJson.info.picURI);
        try {
            const res = await axios.get(contentJson.info.picURI, { responseType: 'arraybuffer'});
            const base64Img = Buffer.from(res.data).toString('base64');

            contentJson.info.pic = `data:image/jpeg;base64,${base64Img}`;
            delete contentJson['info']['picURI'];
        } catch (e) {
            log.error(e.message);
            noAckFunc(messageId);
            return;
        }

    }

    const qtt = {};
    qtt.topic = `mqtt/face/${deviceId}`;
    if(subscribed_client.includes(qtt.topic)) {
        qtt.payload = JSON.stringify(contentJson);
        log.info('qtt is ready to send: ', qtt.payload);
        server.publish(qtt); // 发送消息
        message_id_map.set(messageId, setTimeout(() => {
            noAckFunc(messageId);
        }, 3000));
        return '发送成功';
    } else {
        log.info('device is offline, deviceId is :', deviceId);
        noAckFunc(messageId);
        return '设备不在线';
    }
}

function noAckFunc(messageId) {
    message_id_map.delete(messageId);

    try {
        query(`UPDATE fa_device_operate_log SET max_send_count=max_send_count+1 WHERE message_id = '${messageId}'`);
    }catch (e) {
        log.error(e);
    }
}

async function intervalFunc() {
    try {
        // const result = await query('SELECT id,message_id,device_id,content from fa_device_operate_log WHERE id in (select min(id) from fa_device_operate_log where  (status = "10" OR status = "20") AND max_send_count < 2 AND device_id in (select device_key from fa_device_info) GROUP BY device_id) limit 5');
        const result = await query('SELECT id,message_id,device_id,content from fa_device_operate_log WHERE (status = "10" OR status = "20") AND max_send_count < 3 AND device_id in (select device_key from fa_device_info) GROUP BY device_id');
        result.forEach((item) => {
            sendDataToDevice(item.device_id, item.message_id, item.content);
        });
    } catch(e) {
        log.error(e);
    }
}

setInterval(intervalFunc, 2000);

let visitorCheck = new VistorCheck();
visitorCheck.startVistorCheck();	//开始检测过期访客

module.exports = {
    sendDataToDevice
};