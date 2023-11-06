/*

PET-проект

Телеграм + дискорд бот отслеживания игровой информации с оф сервисов для уведомлений в телеграмме и показе информации онлайн в дискорде для нескольких аккаунтов

*/
// ----- Подключенные библиотеки -----
const axios             = require('axios')
const mongoose          = require('mongoose')
const crypto            = require('crypto')
const TelegramBot       = require('node-telegram-bot-api')
const CronJob           = require('cron').CronJob
const moment            = require('moment-timezone')

const Discord           = require("discord.js")

const { Client, 
       Events, 
       GatewayIntentBits, 
       REST, 
       Routes,
       MessageContent,
       EmbedBuilder,
      }                 = Discord

// -----------------------------
// FILES
const config            = require('./config')

const kb = require('./src/keyboard-buttons')
const keyboard = require('./src/keyboard')
const ikb = require('./src/inline-keyboard')
const cbd = require('./src/callbacks')
const text = require('./src/texts')

// -----------------------------

let MAIN_CHANNEL, resin, cresin, rcur, primogem, transformer, stamina, reserve_stamina, MESSAGE_ID

const TOKEN             = config.TELEGRAM_BOT
const DB_OPTS           = {useNewUrlParser: true, useUnifiedTopology: true}

// -----------------------------
// START DATABASE
mongoose.connect(config.DB_URL, DB_OPTS).then (() => {
    console.log(`База данных подключена`)
}).catch((e) => {
   console.error(e)
})
// -----------------------------
// ПОДКЛЮЧЕНИЕ ФАЙЛОВ СХЕМ
require('./schemas/accounts')
require('./schemas/characters')
require('./schemas/users')
// -----------------------------
// СОЗДАНИЕ ПЕРЕМЕННЫХ МОДЕЛЕЙ
const Account           = mongoose.model('accounts')
const Character         = mongoose.model('characters')

const User              = mongoose.model('users')

// STARTUP  
CheckIn()
CheckInHSR()
let CheckInJob = new CronJob(
	'0,30 0/3,19 * * *',
	function() {
        CheckIn()
        CheckInHSR()
    },
	null,
	true,
	'Europe/Moscow'
)
let BroadCast = new CronJob(
	'0/8 * * * *',
	function() {
//        console.log(`Check Daily инфо по всем аккаунтам с рассылкой! ${GetDateTime(new Date())}`)
        sendBroadcast({})
    },
	null,
	true,
	'Europe/Moscow'
)
let AccsInfoToDB = new CronJob(
	'1/6 * * * *',
	function() {
        getInfoAccs()
//        getInfoAccsHSR()
    },
	null,
	true,
	'Europe/Moscow'
)
let AccsInfoHSRToDB = new CronJob(
	'2/6 * * * *',
	function() {
//        getInfoAccs()
        getInfoAccsHSR()
    },
	null,
	true,
	'Europe/Moscow'
)
let DailyDS = new CronJob(
	'0/1 * * * *',
	function() {
//        console.log(`Check Daily инфо по всем аккаунтам для DS! ${GetDateTime(new Date())}`)
        SendHSR()
        SendToDS(MAIN_CHANNEL)
    },
	null,
	true,
	'Europe/Moscow'
)
let CheckRealmCurrency = new CronJob(
	'15/45 * * * *',
	function() {
//        console.log(`Проверка монет чайника по всем аккаунтам с рассылкой! ${GetDateTime(new Date())}`)
        sendBroadcastRealmCurrency({})
    },
	null,
	true,
	'Europe/Moscow'
)
let CheckDailyTasks = new CronJob(
	'20 5,20 * * *',
	function() {
//        console.log(`Проверка выполнения дейликов по всем аккаунтам с рассылкой! ${GetDateTime(new Date())}`)
        sendBroadcastDailyTasks({})
    },
	null,
	true,
	'Europe/Moscow'
)


let NotifyS = new CronJob(
	'0 6 * * *',
	function() {
        NotifyOne()
    },
	null,
	true,
	'Europe/Moscow'
)

// -----------------------------
// TG BOT
const bot = new TelegramBot(`${TOKEN}`, {polling: true})

bot.setMyCommands([
  { command: '/start', description: 'Начать работу с ботом' },
  { command: '/genshin_masscode', description: 'Ввести промокод ВСЕМ в Genshin Impact' },
  { command: '/hsr_masscode', description: 'Ввести промокод ВСЕМ в Honkai Star Rail' },
  { command: '/gi_code', description: 'Рассылка промокода ВСЕМ для Genshin Impact' },
  { command: '/hsr_code', description: 'Рассылка промокода ВСЕМ для Honkai Star Rail' },
  { command: '/repeat', description: 'Переслать сообщение' },
])


// -----------------------------

const help = `Доступные команды:\n\n/myid - Показать Мой CHAT ID`
const PROMO_LINK = `https://genshin.hoyoverse.com/ru/gift?code=`
const PROMO_LINK_HSR = `https://hsr.hoyoverse.com/gift`

// COMANDS
bot.onText(/\/myid/, (msg) => {
    const cid = msg.chat.id
    sendHTML(cid, `Ваш <b>CHAT ID</b>: <code>${cid}</code>`)
})
bot.onText(/\/repeat/, (msg) => {
    const cid = msg.chat.id
    sendWait(cid, `Введите сообщения для повтора с HTML тегами...`).then(text => {
        sendHTML(cid, text)
    })
})

bot.onText(/\/start/, msg => {
    let chatId = cid(msg)
    let name = msg.from.first_name
    
    GetOne(User, {chatId: chatId}).then(user => {
        if (!user) {
            sendHTML(chatId, `Пользователь не найден!\n\nВведите никнейм...`).then(() => {
                GetText(chatId).then(username => {
                    
                    NewDataId(User, {
                        username,
                        chatId
                    }).then(() => {
                        sendHTML(chatId, `Успешная регистрация, добро пожаловать!`, 'home')
                    }).catch(error => {
                        sendHTML(chatId, `Ошибка регистрации!`)
                    })
                    
                })
            })
        } else {
            sendHTML(chatId, `Добро пожаловать, ${user.username}!`, 'home')
        }
    })
    
})

bot.onText(/\/gi_code/, (msg, [source, match]) => {
    let chatId = cid(msg)
    sendWait(chatId, `Введите код для GI...`).then(code => {
        if (code != '-') {
            GetData(User, {}).then(users => {
                users.forEach(user => {
                    if (user.settings.promocodes) {
                        sendHTML(user.chatId, `Новый промокод GI!\n\nКопипаст кликом: <code>${code}</code>\nСсылка: <a href="${PROMO_LINK}${code}">${code}</a>`)
                    }
                })
            })
        }
    })
})
bot.onText(/\/hsr_code/, (msg, [source, match]) => {
    let chatId = cid(msg)
    sendWait(chatId, `Введите код для HSR...`).then(code => {
        if (code != '-') {
            GetData(User, {}).then(users => {
                users.forEach(user => {
                    if (user.settings.promocodes) {
                        sendHTML(user.chatId, `Новый промокод HSR!\n\nКопипаст кликом: <code>${code}</code>\nСсылка без автозаполнения: <a href="${PROMO_LINK_HSR}">${code}</a>`)
                    }
                })
            })
        }
    })
})

bot.onText(/\/genshin_masscode/, (msg, [source, match]) => {
    let chatId = cid(msg)
    sendWait(chatId, `Введите общий промокод для Genshin Impact...`).then(code => {
        if (code != '-') {
            GetData(User, {}).then(users => {
                users.forEach(user => {
                    if (user.settings.promocodes) {
                        sendHTML(user.chatId, `Новый промокод GI!\n\nКопипаст кликом: <code>${code}</code>\nСсылка: <a href="${PROMO_LINK}${code}">${code}</a>`)
                    }
                })
            })
            GetData(Account, {cookie: {$ne: undefined}, cookie_v2: {$ne: undefined}, account_mid_v2: {$ne: undefined}}).then(accounts => {
                
                accounts.every(account => {
                    let uid = account.uid
                    
                    giftCodeGI(uid, code).then(res => {
                        if (res.message == `Код обмена больше не действителен.`) {
                            sendHTML(chatId, `${res.message} - \`${code}\` `, null, 'Markdown')
                            return false;
                        }
                        
                        GetOne(User, {id: account.idUser}).then(user => {
                            let uchatId = user.chatId
                            
                            if (res.message == `OK`) {
                                sendHTML(uchatId, `Промокод \`${code}\` Genshin Impact \`${account.game_nickname}\`

*${res.data.msg}*`, null, 'Markdown')
                            }
                            else if (res.message == 'Подарочный код уже активирован') {
                                sendHTML(uchatId, `Промокод \`${code}\` Genshin Impact \`${account.game_nickname}\`

*${res.message}*`, null, 'Markdown')
                            }
                        })
                        
                    })
                    
                })
                
            })
        }
    })
})
bot.onText(/\/hsr_masscode/, (msg, [source, match]) => {
    let chatId = cid(msg)
    sendWait(chatId, `Введите общий промокод для Honkai: Star Rail...`).then(code => {
        if (code != '-') {
            GetData(User, {}).then(users => {
                users.forEach(user => {
                    if (user.settings.promocodes) {
                        sendHTML(user.chatId, `Новый промокод HSR!\n\nКопипаст кликом: <code>${code}</code>\nСсылка без автозаполнения: <a href="${PROMO_LINK_HSR}">${code}</a>`)
                    }
                })
            })
            GetData(Account, {hsr: true, cookie: {$ne: undefined}, cookie_v2: {$ne: undefined}, account_mid_v2: {$ne: undefined}}).then(accounts => {
                
                accounts.every(account => {
                    let hsr_uid = account.hsr_uid
                    
                    giftCodeHSR(hsr_uid, code).then(res => {
                        if (res.message == `Промокод больше не действителен`) {
                            sendHTML(chatId, `${res.message} - \`${code}\` `, null, 'Markdown')
                            return false;
                        }
                        GetOne(User, {id: account.idUser}).then(user => {
                            let uchatId = user.chatId
                            
                            if (res.message == `OK`) {
                                sendHTML(uchatId, `Промокод \`${code}\` Honkai Star Rail \`${account.game_nickname}\`

*${res.data.msg}*`, null, 'Markdown')
                            }
                            else if (res.message == 'Промокод уже активирован') {
                                sendHTML(uchatId, `Промокод \`${code}\` Honkai Star Rail \`${account.game_nickname}\`

*${res.message}*`, null, 'Markdown')
                            }
                        })
                        
                    })
                })
                
            })
        }
    })
})


bot.on('message', (msg) => {
    let chatId = cid(msg)
    let message = msg.text
    
    GetOne(User, {chatId}).then(user => {
        let set = user.settings
        let msg = ``
        let onoff = ``
    switch (message) {
        case kb.main_menu:
        case kb.cancel:
            sendHTML(chatId, text.home, 'home')
        break
        case kb.home.settings:
        case kb.settings.back:
            sendHTML(chatId, text.settings, 'settings')
        break
        case kb.home.hsr_10:
            GetData(Account, {idUser: user.id, hsr: true}, {_id: 1}).then(accs => {
                let kb = []
                let cres = ``
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `HSR10_u:${acc.hsr_uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для напоминания!`, [kb], 'Markdown')
            })
        break
        
        case kb.home.promocode:
            GetData(Account, {idUser: user.id, cookie: {$ne: undefined}, cookie_v2: {$ne: undefined}, account_mid_v2: {$ne: undefined}}, {_id: 1}).then(accs => {
                let kb = []
                let gi = []
                let hsr = []
                let cres = ``
                accs.forEach(acc => {
                    let textGI = `GI: ${acc.game_nickname}`
                    let cbGI = `PromoGI_u:${acc.uid}`
                    let btn = {
                        text: textGI,
                        callback_data: cbGI
                    }
                    gi.push(btn)
                    
                    if (acc.hsr) {
                        let textHSR = `HSR: ${acc.game_nickname}`
                        let cbHSR = `PromoHSR_u:${acc.hsr_uid}`
                        let btn = {
                            text: textHSR,
                            callback_data: cbHSR
                        }
                        hsr.push(btn)
                    }
                })
                
                sendHTMLi(chatId, `Выберите нужный аккаунт для ввода промокода!

Для ввода промокодов нужно сохранить \`cookie_token\`, \`cookie_token_v2\` и \`account_mid_v2\`

*⚙️ Настройки > 🍪 Добавить Cookie*
`, [gi, hsr], 'Markdown')
            })
        break
        case kb.home.notify:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                let cres = ``
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `NotifyUID_u:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для напоминания!`, [kb], 'Markdown')
            })
        break
        case kb.home.condensed_resin:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                let cres = ``
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    cres += `*${acc.game_nickname}*: \`${acc.condensed_resin}\`\n`
                    let cb = `CResin_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для отметки 💎 густой смолы!

Сейчас густых:\n${cres}`, [kb], 'Markdown')
            })
        break
        // ---------- НАСТРОЙКИ -----------
        
        case kb.settings.notifications_menu:
            sendHTML(chatId, text.notifications, 'notifications')
        break
        
        case kb.settings.notifications:
            onoff = set.notifications ? kb.status_on : kb.status_off
            msg = `🔔 Общие уведомления на всё...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:notifications`)
        break
        case kb.settings.checkin:
            onoff = set.checkin ? kb.status_on : kb.status_off
            msg = `✅ Уведомления на отметки...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:checkin`)
        break
        case kb.settings.promocodes:
            onoff = set.promocodes ? kb.status_on : kb.status_off
            msg = `✉️ Уведомления на промокоды...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:promocodes`)
        break
        case kb.settings.dailies:
            onoff = set.dailies ? kb.status_on : kb.status_off
            msg = `🗞 Уведомления на ежедневные задания...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:dailies`)
        break
        case kb.settings.realm_currency:
            onoff = set.realm_currency ? kb.status_on : kb.status_off
            msg = `🫖 Чайник...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:realm_currency`)
        break
        case kb.settings.transformer:
            onoff = set.transformer ? kb.status_on : kb.status_off
            msg = `🎛 Преобразователь откатился...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:transformer`)
        break
        case kb.settings.expeditions:
            onoff = set.expeditions ? kb.status_on : kb.status_off
            msg = `🏃‍♂️ Экспедиции пришли...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:expeditions`)
        break
        case kb.settings.realm_seeding:
            onoff = set.seeding ? kb.status_on : kb.status_off
            msg = `🌱 Посевы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:seeding`)
        break
        case kb.settings.realm_furnishing:
            onoff = set.craft ? kb.status_on : kb.status_off
            msg = `🪑 Крафт мебели...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:craft`)
        break
        
        // СМОЛА
        case kb.settings.resin:
            sendHTML(chatId, text.resin, 'resin')
        break
        case kb.settings.resin_each_40:
            onoff = set.resin_each_40 ? kb.status_on : kb.status_off
            msg = `Каждые 40 смолы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:resin_each_40`)
        break
        case kb.settings.resin_140:
            onoff = set.resin_140 ? kb.status_on : kb.status_off
            msg = `Уведомление на 140 смолы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:resin_140`)
        break
        case kb.settings.resin_150:
            onoff = set.resin_150 ? kb.status_on : kb.status_off
            msg = `Уведомление на 150 смолы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:resin_150`)
        break
        case kb.settings.resin_which:
            onoff = set.resin_which ? kb.status_on : kb.status_off
            msg = `Уведомление на заданных Х смолы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:resin_which`)
        break
        case kb.settings.resin_overflow:
            onoff = set.resin_overflow ? kb.status_on : kb.status_off
            msg = `Уведомление на перекапе в 160+ смолы...\n\nСейчас: ${onoff}`
            Setting(chatId, msg, `id:${user.id},set:resin_overflow`)
        break
        //
        
        // SETTINGS
        case kb.settings.add:
            sendWait(chatId, `Введите <pre>ltuid</pre>`, 'cancel').then(ltuid => {
                if (Mapping(ltuid)) {
                    sendWait(chatId, `Введите <pre>ltoken</pre>`, 'cancel').then(ltoken => {
                        if (Mapping(ltuid)) {
                            checkCookies(ltuid, ltoken).then(profile => {
                                let info = `Аккаунт:\n
Никнейм: <code>${profile.nickname}</code>
UID: <code>${profile.game_role_id}</code>
Ранг приключения: <code>${profile.level}</code>
Регион: <code>${profile.region_name}</code>`
                                sendHTMLi(chatId, info, [
                                    [
                                        {
                                            text: kb.settings.yes,
                                            callback_data: `AddAY_uid:${ltuid},tok:${ltoken}`
                                        },
                                        {
                                            text: kb.settings.no,
                                            callback_data: cbd.cancel_home
                                        }
                                    ]
                                ])
                            })
                        }
                    })
                }
            })
        break
        case kb.settings.add_cookie:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                let cres = ``
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `AddCookie_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для добавления Cookie`, [kb], 'Markdown')
            })
            
        break
        case kb.settings.delete:
            GetData(Account, {idUser: user.id}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `Del_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите аккаунт для удаления...`, [kb])
            })
        break
        
        case kb.settings.show_status:
            GetData(Account, {idUser: user.id}).then(accs => {
                let set_user = user.settings
                let text_set = `✅ Статусы всех настроек\n`
                
                text_set += `\n${kb.settings.notifications}: ${set_user.notifications ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.checkin}: ${set_user.checkin ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.realm_currency}: ${set_user.realm_currency ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.resin_each_40}: ${set_user.resin_each_40 ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.resin_140}: ${set_user.resin_140 ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.resin_150}: ${set_user.resin_150 ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.resin_which}: ${set_user.resin_which ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.resin_overflow}: ${set_user.resin_overflow ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.transformer}: ${set_user.transformer ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.expeditions}: ${set_user.expeditions ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.realm_seeding}: ${set_user.seeding ? kb.status_on : kb.status_off}`
                text_set += `\n${kb.settings.realm_furnishing}: ${set_user.craft ? kb.status_on : kb.status_off}`
                
                for (let acc of accs) {
                    let set_account = acc.settings
                    text_set += `\n\nАккаунт: <code>${acc.game_nickname}</code>`
                    text_set += `\nСмола на: ${set_account.resin_which}`
                    text_set += `\nМонеты больше или равно: ${set_account.current_home_coin} монет`
                    text_set += `\n${kb.settings.expeditions}: ${set_account.expeditions ? kb.status_on : kb.status_off}`
                    text_set += `\n${kb.settings.realm_seeding}: ${set_account.seeding ? kb.status_on : kb.status_off}`
                    text_set += `\n${kb.settings.realm_furnishing}: ${set_account.craft ? kb.status_on : kb.status_off}`
                    text_set += set_account.transformer_mins != -1 ? `\nПреобразователь меньше: ${set_account.transformer_mins} минут` : `\nПреобразователь отключен`
                }
                sendHTML(user.chatId, text_set)
                
            })
        break
        
        case kb.settings.add_hsr:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                let cres = ``
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `AddHSR_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для отметки в 🚅 HSR`, [kb], 'Markdown')
            })
        break
        //                  PARAMS
        case kb.settings.params:
        case kb.settings.cancel_p:
            sendHTML(chatId, text.params, 'params')
        break
        case kb.settings.p_resin_which:
            sendWait(chatId, `Введите количество смолы на котором нужно уведомление...`, 'cancel_params').then(resin => {
                if (Mapping(resin)) {
                    GetData(Account, {idUser: user.id}).then(accs => {
                        let kb = []
                        accs.forEach(acc => {
                            let text = acc.game_nickname
                            let cb = `SetXr_a:${acc.uid},r:${resin}`
                            let btn = {
                                text,
                                callback_data: cb
                            }
                            kb.push(btn)
                        })
//                        {
//                            text: `Отмена`,
//                            callback_data: `cancel_set_x`
//                        }
                        sendHTMLi(chatId, `Выберите аккаунт на котором нужно изменить параметр...`, [kb, ikb.cancel_params])
                    })
                }
            })
        break
        case kb.settings.p_transformer:
            sendWait(chatId, `Введите минуты меньше которых будет уведомление на преобразователь...\n\nВведите <b>-1</b> чтобы отключить уведомление на аккаунт.`, 'cancel_params').then(mins => {
                if (Mapping(mins)) {
                    GetData(Account, {idUser: user.id}).then(accs => {
                        let kb = []
                        accs.forEach(acc => {
                            let text = acc.game_nickname
                            let cb = `SetTm_a:${acc.uid},m:${mins}`
                            let btn = {
                                text,
                                callback_data: cb
                            }
                            kb.push(btn)
                        })
                        sendHTMLi(chatId, `Выберите аккаунт на котором нужно изменить параметр...`, [kb, ikb.cancel_params])
                    })
                }
            })
        break
        case kb.settings.p_realm_currency:
            sendWait(chatId, `Введите монеты больше которых будет уведомление на чайник...`, 'cancel_params').then(cur => {
                if (Mapping(cur)) {
                    GetData(Account, {idUser: user.id}).then(accs => {
                        let kb = []
                        accs.forEach(acc => {
                            let text = acc.game_nickname
                            let cb = `SetRCv_a:${acc.uid},c:${cur}`
                            let btn = {
                                text,
                                callback_data: cb
                            }
                            kb.push(btn)
                        })
                        sendHTMLi(chatId, `Выберите аккаунт на котором нужно изменить параметр...`, [kb, ikb.cancel_params])
                    })
                }
            })
        break
        case kb.settings.p_expeditions:
            GetData(Account, {idUser: user.id}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let ntext = acc.settings.expeditions ? `🔔` : `🔕`
                    let text = `${ntext} ${acc.game_nickname}`
                    let cb = `SetExpAccTurn_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, text.params_turn_exp, [kb, ikb.cancel_params])
            })
        break
        case kb.settings.p_realm_seeding:
            GetData(Account, {idUser: user.id}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let ntext = acc.settings.expeditions ? `🔔` : `🔕`
                    let text = `${ntext} ${acc.game_nickname}`
                    let cb = `SetSedAccTurn_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, text.params_turn_sed, [kb, ikb.cancel_params])
            })
        break
        case kb.settings.p_realm_furnishing:
            GetData(Account, {idUser: user.id}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let ntext = acc.settings.craft ? `🔔` : `🔕`
                    let text = `${ntext} ${acc.game_nickname}`
                    let cb = `SetCraftAccTurn_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, text.params_turn_craft, [kb, ikb.cancel_params])
            })
        break
        
        
        // --------------------------------
        case kb.home.show_s:
            sendHTMLi(chatId, text.gath_info, []).then(msg => {
                let { message_id } = msg
                GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                    CheckArrayDailyShort(accs).then(info => {
                        editText(info, chatId, message_id, [])
//                            sendHTML(chatId, info, 'home')
                    })
                })
            })
        break
        case kb.home.show_f:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `ShowFull_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                sendHTMLi(chatId, `Выберите нужный аккаунт для получения полной информации!`, [kb])
            })
        break
        case kb.home.seeding:
            GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                let kb = []
                accs.forEach(acc => {
                    let text = acc.game_nickname
                    let cb = `StartSeed_a:${acc.uid}`
                    let btn = {
                        text,
                        callback_data: cb
                    }
                    kb.push(btn)
                })
                
                sendHTMLi(chatId, `Выберите нужный аккаунт для отметки старта 🌱 Посевов!`, [kb, [
                    {
                        text: `Стереть`,
                        callback_data: cbd.clear_seeding
                    }
                ]])
            })
        break
    }
    })
})
bot.on('callback_query', query => {
    const {chat, message_id, reply_markup} = query.message
    const textMsg = query.message.text
    const data = query.data
    const chatId = chat.id
    const telegramUsername = chat.username
    
    let textSetting = ``
    
//    console.log(data)
    
    GetOne(User, {chatId}).then(user => {
    switch (data) {
        case cbd.cancel_home:
            sendHTML(chatId, text.home, 'home')
        break
        case cbd.cancel:
            editText(text.home, chatId, message_id, 'home')
        break
        case cbd.delno:
            editText(`Отмена удаления...`, chatId, message_id, [])
        break
        case cbd.cancel_set_x:
            editText(`Отмена ввода...`, chatId, message_id, [])
            sendHTML(chatId, text.params, 'params')
        break
        case cbd.clear_seeding:
            
        break
        case '':
            
        break
        default: 
            if (Has(data, 'StartSeed_')) {
                let uid = GetElement(data, 'a')
                GetOne(Account, {uid}).then(account => {
                    let start = new Date()
                    let finish = new Date(start.getTime() + ((2 * 24 + 22) * 60 * 60 * 1000))
                    let status = false
                    
                    UpdateOne(Account, {uid}, {$set: {
                        "sereniteaPot.seeding.start": start,
                        "sereniteaPot.seeding.finish": finish,
                        "sereniteaPot.seeding.status": status,
                    }}).then(() => {
                        editText(`${kb.settings.realm_seeding} для аккаунта ${account.game_nickname} запущены!

Старт посевов: <b>${GetDateTime(start)}</b>
Конец посевов: <b>${GetDateTime(finish)}</b>`, chatId, message_id)
                    })
                })
            }
            // accs
            if (Has(data, 'AddAY_')) {
                let ltuid = GetElement(data, 'uid')
                let ltoken = GetElement(data, 'tok')
                
                checkCookies(ltuid, ltoken).then(profile => {

                    let username = user.username
                    let idUser = user.id
                    let uid = profile.game_role_id
                    let server = profile.region
                    let game_nickname = profile.nickname

//                        console.log({textMsg})

                    NewDataId(Account, {
                        idUser,
                        username,
                        uid,
                        server,
                        ltuid,
                        ltoken,
                        game_nickname,
                    }).then(() => {
                        editText(textMsg, chatId, message_id, []).then(() => {
                            sendHTML(chatId, `Аккаунт <code>${profile.nickname}</code> добавлен!`, 'home')
                        })
                    })
                })
            }
            if (Has(data, 'Del_')) {
                let uid = GetElement(data, 'a')
                editText(`⚠️ Вы точно хотите удалить аккаунт?`, chatId, message_id, [
                    [
                        {
                            text: kb.settings.yes,
                            callback_data: `DelYes_a:${uid}`
                        },
                        {
                            text: kb.settings.no,
                            callback_data: cbd.delno
                        }
                    ]
                ])
            }
            if (Has(data, 'DelYes_')) {
                let uid = GetElement(data, 'a')
                GetOne(Account, {uid}).then(account => {
                    let nick = account.game_nickname
                    RemoveOne(Account, {uid}).then(() => {
                        editText(`⚠️ Аккаунт <b>${nick} (${uid})</b> удален...`, chatId, message_id, [])
                    })
                })
            }
            
            
            if (Has(data, 'PromoGI_')) {
                let acc = GetElement(data, 'u')
                
                GetOne(Account, {uid: acc}).then(account => {
                    editWait(`⏳ ⏳ ⏳ Введите промокод для активации на аккаунт...

*Genshin Impact*: \`${account.game_nickname}\``, chatId, message_id, null, 'Markdown').then(promocode => {
                        
                        giftCodeGI(acc, promocode).then(res => {
                            if (res.message == `OK`) {
                                sendHTML(chatId, `${res.data.msg} - GI - ${account.game_nickname}`)
                            } else {
                                sendHTML(chatId, `${res.message} - ${account.game_nickname}`)
                            }
                        })
                        
                    })
                })
                
            }
            if (Has(data, 'PromoHSR_')) {
                let acc = GetElement(data, 'u')
                
                GetOne(Account, {hsr_uid: acc}).then(account => {
                    editWait(`⏳ ⏳ ⏳ Введите промокод для активации на аккаунт...

*Honkai Star Rail*: \`${account.game_nickname}\``, chatId, message_id, null, 'Markdown').then(promocode => {
                        
                        giftCodeHSR(acc, promocode).then(res => {
                            if (res.message == `OK`) {
                                sendHTML(chatId, `${res.data.msg} - HSR - ${account.game_nickname}`)
                            } else {
                                sendHTML(chatId, `${res.message} - ${account.game_nickname}`)
                            }
                        })
                        
                    })
                })
                
            }
            
            
            
            
            if (Has(data, 'AddHSR_')) {
                let acc = GetElement(data, 'a')
                
                GetOne(Account, {uid: acc}).then(account => {
                    sendWait(chatId, `Введите UID из HSR для добавления аккаунта к 🍪 Кукисам *${account.game_nickname}*`, null, 'Markdown').then(uid_hsr => {
                        if (Mapping(uid_hsr)) {
                            sendHTMLi(chatId, `Вы точно хотите привязать аккаунт HSR \`${uid_hsr}\` к 🍪 Кукисам аккаунта геншина *${account.game_nickname}*`, [
                                [
                                    {
                                        text: `Да`,
                                        callback_data: `AddHSRY_a:${acc},uh:${uid_hsr}`
                                    },
                                    {
                                        text: `Нет`,
                                        callback_data: cbd.cancel_home
                                    }
                                ]
                            ], 'Markdown')
                        }
                    })
                })
            }
            
            if (Has(data, 'AddCookie_')) {
                let acc = GetElement(data, 'a')
                
                GetOne(Account, {uid: acc}).then(account => {
                    editWait(`Введите <code>cookie_token</code> для аккаунта <code>${account.game_nickname}</code>

Получить его на сайте <a href="https://genshin.hoyoverse.com/ru/gift">Genshin Impact</a> или <a href="https://hsr.hoyoverse.com/gift">Honkai Star Rail</a> для получения промокодов автоматом!`, chatId, message_id, 'cancel').then(cookie_token => {
                        if (Mapping(cookie_token)) {
                            
                            
                            
                            editWait(`Введите <code>cookie_token_v2</code> для аккаунта <code>${account.game_nickname}</code>

Получить его на сайте <a href="https://genshin.hoyoverse.com/ru/gift">Genshin Impact</a> или <a href="https://hsr.hoyoverse.com/gift">Honkai Star Rail</a> для получения промокодов автоматом!`, chatId, message_id, 'cancel').then(cookie_token_v2 => {
                        if (Mapping(cookie_token_v2)) {
                            
                            editWait(`Введите <code>account_mid_v2</code> для аккаунта <code>${account.game_nickname}</code>

Получить его на сайте <a href="https://genshin.hoyoverse.com/ru/gift">Genshin Impact</a> или <a href="https://hsr.hoyoverse.com/gift">Honkai Star Rail</a> для получения промокодов автоматом!`, chatId, message_id, 'cancel').then(account_mid_v2 => {
                        if (Mapping(account_mid_v2)) {
                            
                            UpdateOne(Account, {uid: acc}, {
                                $set: {
                                    "cookie": cookie_token,
                                    "cookie_v2": cookie_token_v2,
                                    "account_mid_v2": account_mid_v2,
                                }
                            }).then(() => {
                                editText(`🍪 Cookie добавлены для аккаунта \`${account.game_nickname}\``, chatId, message_id, null, 'MarkdownV2')
                            })
                        }
                        
                        
                    })
                        }
                    })
                        }
                    })
                })
            }
            
            if (Has(data, 'AddHSRY_')) {
                let acc = GetElement(data, 'a')
                let uid_hsr = GetElement(data, 'uh')
                
                UpdateOne(Account, {uid: acc}, {
                    $set: {
                        "hsr": true,
                        "hsr_uid": uid_hsr
                    }
                }).then(() => {
                    editText(`Аккаунт отмечен для HSR!`, chatId, message_id)
                })
            }
            
            // info accs
            if (Has(data, 'ShowFull_')) {
                let uid = GetElement(data, 'a')
                editText(text.gath_info, chatId, message_id, []).then(() => {
                    GetOne(Account, {uid}).then(account => {
                        CheckArrayDailyFull(account).then(info => {
                            editText(info, chatId, message_id, [])
                        })
                    })
                })
            }
            
            // resin
            if (Has(data, 'CResin_')) {
                let uid = GetElement(data, 'a')
                GetOne(Account, {uid}).then(acc => {
                    editText(`Выберите количество 💎 густой смолы

Сейчас у *${acc.game_nickname}*: *${acc.condensed_resin}* густой смолы
`, chatId, message_id, [
                        [
                            {
                                text: `0`,
                                callback_data: `CResinA_a:${uid},r:0`
                            },
                            {
                                text: `1`,
                                callback_data: `CResinA_a:${uid},r:1`
                            },
                            {
                                text: `2`,
                                callback_data: `CResinA_a:${uid},r:2`
                            },
                        ],
                        [
                            {
                                text: `3`,
                                callback_data: `CResinA_a:${uid},r:3`
                            },
                            {
                                text: `4`,
                                callback_data: `CResinA_a:${uid},r:4`
                            },
                            {
                                text: `5`,
                                callback_data: `CResinA_a:${uid},r:5`
                            },
                        ],
                        [
                            {
                                text: kb.cancel,
                                callback_data: cbd.cancel
                            }
                        ]
                    ], 'Markdown')
                })
            }
            if (Has(data, 'CResinA_')) {
                let uid = GetElement(data, 'a')
                let resin = GetElement(data, 'r')
                
                GetOne(Account, {uid}).then(acc => {
                    UpdateOne(Account, {uid}, {
                        $set: {
                            "condensed_resin": resin
                        }
                    }).then(() => {
                        GetData(Account, {idUser: user.id}, {_id: 1}).then(accs => {
                            let kb = []
                            let cres = ``
                            accs.forEach(acc => {
                                let text = acc.game_nickname
                                cres += `*${acc.game_nickname}*: \`${acc.condensed_resin}\`\n`
                                let cb = `CResin_a:${acc.uid}`
                                let btn = {
                                    text,
                                    callback_data: cb
                                }
                                kb.push(btn)
                            })
                            editText(`💎 Густой смолы \`${resin}\` было установлено на аккаунте \`${acc.game_nickname}\`

Выберите нужный аккаунт для отметки 💎 густой смолы!

Сейчас густых:\n${cres}
`, chatId, message_id, [kb], 'Markdown')
                        })
                        
                    })
                })
            }
            
            // notify
            if (Has(data, 'NotifyUID_')) {
                let uid = GetElement(data, 'u')
                
                editText(`Выберите день недели`, chatId, message_id, [
                    [
                        {
                            text: 'Воскресенье',
                            callback_data: `Notify_d:0,u:${uid}`
                        },
                        {
                            text: 'Понедельник',
                            callback_data: `Notify_d:1,u:${uid}`
                        },
                        {
                            text: 'Вторник',
                            callback_data: `Notify_d:2,u:${uid}`
                        },
                    ],
                    [
                        {
                            text: 'Среда',
                            callback_data: `Notify_d:3,u:${uid}`
                        },
                    ],
                    [
                        {
                            text: 'Четверг',
                            callback_data: `Notify_d:4,u:${uid}`
                        },
                        {
                            text: 'Пятница',
                            callback_data: `Notify_d:5,u:${uid}`
                        },
                        {
                            text: 'Суббота',
                            callback_data: `Notify_d:6,u:${uid}`
                        },
                    ]
                ])
            }
            if (Has(data, 'Notify_')) {
                let uid = GetElement(data, 'u')
                let day = +GetElement(data, 'd')
                GetOne(Account, {uid}).then(acc => {
                    editWait(`Введите сообщение напоминания на \`${DayStr(day)}\` для \`${acc.game_nickname}\``, chatId, message_id, null, 'Markdown').then(message => {
                        UpdateOne(Account, {uid}, {
                            $set: {
                                "notify.day": day,
                                "notify.message": message
                            }
                        }).then(() => {
                            editText(`Напоминание установлено на \`${DayStr(day)}\` для \`${acc.game_nickname}\`\n\nТекст напоминания:\n${message}`, chatId, message_id, null, 'Markdown')
                        })
                    })
                })
            }
            
            if (Has(data, 'HSR10_')) {
                let uid = GetElement(data, 'u')
                GetOne(Account, {hsr_uid: uid}).then(acc => {
                    let new_date = moment().add(16, 'hours')
                    UpdateOne(Account, {hsr_uid: acc.hsr_uid}, {
                        $set: {
                            "hsr_date": new_date
                        }
                    }).then(() => {
                        editText(`В \`${new_date.format('DD.MM HH:mm')}\` для \`${acc.game_nickname}\` (\`${uid}\`) будет уведомление о смоле в HSR!`, chatId, message_id, null, 'Markdown')
                    })

                })
            }
            
            
            // settings
            if (Has(data, 'SetY_')) {
                let id = GetElement(data, 'id')
                let set = GetElement(data, 'set')
                let new_data = {}
                
                switch(set) {
                    case 'notifications':
                        textSetting = `🔔 Общие уведомления на всё...\n\nСейчас: `
                        new_data = {
                            "settings.notifications": true
                        }
                    break
                    case 'checkin':
                        textSetting = `✅ Уведомления на отметки...\n\nСейчас: `
                        new_data = {
                            "settings.checkin": true
                        }
                    break
                    case 'promocodes':
                        textSetting = `✉️ Уведомления на промокоды...\n\nСейчас: `
                        new_data = {
                            "settings.promocodes": true
                        }
                    break
                    case 'dailies':
                        textSetting = `🗞 Уведомления на ежедневные задания...\n\nСейчас: `
                        new_data = {
                            "settings.dailies": true
                        }
                    break
                    case 'realm_currency':
                        textSetting = `🫖 Чайник...\n\nСейчас: `
                        new_data = {
                            "settings.realm_currency": true
                        }
                    break
                    case 'transformer':
                        textSetting = `🎛 Преобразователь откатился...\n\nСейчас: `
                        new_data = {
                            "settings.transformer": true
                        }
                    break
                    case 'expeditions':
                        textSetting = `🏃‍♂️ Экспедиции пришли...\n\nСейчас: `
                        new_data = {
                            "settings.expeditions": true
                        }
                    break
                    case 'seeding':
                        textSetting = `🌱 Посевы...\n\nСейчас: `
                        new_data = {
                            "settings.seeding": true
                        }
                    break
                    case 'craft':
                        textSetting = `🪑 Крафт мебели...\n\nСейчас: `
                        new_data = {
                            "settings.craft": true
                        }
                    break
                    
                    
                    case 'resin_each_40':
                        textSetting = `Каждые 40 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_each_40": true
                        }
                    break
                    case 'resin_140':
                        textSetting = `Уведомление на 140 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_140": true
                        }
                    break
                    case 'resin_150':
                        textSetting = `Уведомление на 150 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_150": true
                        }
                    break
                    case 'resin_which':
                        textSetting = `Уведомление на заданных Х смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_which": true
                        }
                    break
                    case 'resin_overflow':
                        textSetting = `Уведомление на перекапе в 160+ смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_overflow": true
                        }
                    break
                }
                
                UpdateOne(User, {id}, {
                    $set: new_data
                }).then(() => {
                    textSetting += kb.status_on
                    editText(textSetting, chatId, message_id, reply_markup.inline_keyboard)
                }).catch(error => {
                    console.error(error)
                })
            }
            if (Has(data, 'SetN_')) {
                let id = GetElement(data, 'id')
                let set = GetElement(data, 'set')
                let new_data = {}
                
                switch(set) {
                    case 'notifications':
                        textSetting = `🔔 Общие уведомления на всё...\n\nСейчас: `
                        new_data = {
                            "settings.notifications": false
                        }
                    break
                    case 'checkin':
                        textSetting = `✅ Уведомления на отметки...\n\nСейчас: `
                        new_data = {
                            "settings.checkin": false
                        }
                    break
                    case 'promocodes':
                        textSetting = `✉️ Уведомления на промокоды...\n\nСейчас: `
                        new_data = {
                            "settings.promocodes": false
                        }
                    break
                    case 'dailies':
                        textSetting = `🗞 Уведомления на ежедневные задания...\n\nСейчас: `
                        new_data = {
                            "settings.dailies": false
                        }
                    break
                    case 'realm_currency':
                        textSetting = `🫖 Чайник...\n\nСейчас: `
                        new_data = {
                            "settings.realm_currency": false
                        }
                    break
                    case 'transformer':
                        textSetting = `🎛 Преобразователь откатился...\n\nСейчас: `
                        new_data = {
                            "settings.transformer": false
                        }
                    break
                    case 'expeditions':
                        textSetting = `🏃‍♂️ Экспедиции пришли...\n\nСейчас: `
                        new_data = {
                            "settings.expeditions": false
                        }
                    break
                    case 'seeding':
                        textSetting = `🌱 Посевы...\n\nСейчас: `
                        new_data = {
                            "settings.seeding": false
                        }
                    break
                    case 'craft':
                        textSetting = `🪑 Крафт мебели...\n\nСейчас: `
                        new_data = {
                            "settings.craft": false
                        }
                    break
                    
                    
                    case 'resin_each_40':
                        textSetting = `Каждые 40 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_each_40": false
                        }
                    break
                    case 'resin_140':
                        textSetting = `Уведомление на 140 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_140": false
                        }
                    break
                    case 'resin_150':
                        textSetting = `Уведомление на 150 смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_150": false
                        }
                    break
                    case 'resin_which':
                        textSetting = `Уведомление на заданных Х смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_which": false
                        }
                    break
                    case 'resin_overflow':
                        textSetting = `Уведомление на перекапе в 160+ смолы...\n\nСейчас: `
                        new_data = {
                            "settings.resin_overflow": false
                        }
                    break
                }
                
                UpdateOne(User, {id}, {
                    $set: new_data
                }).then(() => {
                    textSetting += kb.status_off
                    editText(textSetting, chatId, message_id, reply_markup.inline_keyboard)
                }).catch(error => {
                    console.error(error)
                })
            }
            
            if (Has(data, 'SetXr_')) {
                let uid = GetElement(data, 'a')
                let resin = GetElement(data, 'r')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.resin_which": +resin
                        }
                    }).then(() => {
                        editText(`Уведомление на <code>${resin}</code> смолы теперь будет работать на аккаунте <b>${acc.game_nickname}</b>!`, chatId, message_id, []).then(() => {
                            sendHTML(chatId, `💾 Настройка параметров для уведомлений`, 'params')
                        })
                    })
                })
            }
            if (Has(data, 'SetTm_')) {
                let uid = GetElement(data, 'a')
                let mins = GetElement(data, 'm')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.transformer_mins": +mins
                        }
                    }).then(() => {
                        editText(`Уведомление при минутах меньше <code>${mins}</code> на преобразователе теперь будет работать на аккаунте <b>${acc.game_nickname}</b>!`, chatId, message_id, []).then(() => {
                            sendHTML(chatId, `💾 Настройка параметров для уведомлений`, 'params')
                        })
                    })
                })
            }
            if (Has(data, 'SetRCv_')) {
                let uid = GetElement(data, 'a')
                let cur = GetElement(data, 'c')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.current_home_coin": +cur
                        }
                    }).then(() => {
                        editText(`Уведомление при монетах больше или равно <code>${cur}</code> теперь будет работать на аккаунте <b>${acc.game_nickname}</b>!`, chatId, message_id, []).then(() => {
                            sendHTML(chatId, `💾 Настройка параметров для уведомлений`, 'params')
                        })
                    })
                })
            }
            
            if (Has(data, 'SetExpAccTurn_')) {
                let uid = GetElement(data, 'a')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.expeditions": !acc.settings.expeditions
                        }
                    }).then(() => {
                        GetData(Account, {idUser: user.id}).then(accs => {
                            let kb = []
                            accs.forEach(acc => {
                                let ntext = acc.settings.expeditions ? `🔔` : `🔕`
                                let text = `${ntext} ${acc.game_nickname}`
                                let cb = `SetExpAccTurn_a:${acc.uid}`
                                let btn = {
                                    text,
                                    callback_data: cb
                                }
                                kb.push(btn)
                            })
                            editText(text.params_turn_exp, chatId, message_id, [kb, ikb.cancel_params])
                        })
                    })
                })
            }
            if (Has(data, 'SetSedAccTurn_')) {
                let uid = GetElement(data, 'a')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.seeding": !acc.settings.seeding
                        }
                    }).then(() => {
                        GetData(Account, {idUser: user.id}).then(accs => {
                            let kb = []
                            accs.forEach(acc => {
                                let ntext = acc.settings.seeding ? `🔔` : `🔕`
                                let text = `${ntext} ${acc.game_nickname}`
                                let cb = `SetSedAccTurn_a:${acc.uid}`
                                let btn = {
                                    text,
                                    callback_data: cb
                                }
                                kb.push(btn)
                            })
                            editText(text.params_turn_sed, chatId, message_id, [kb, ikb.cancel_params])
                        })
                    })
                })
            }
            if (Has(data, 'SetCraftAccTurn_')) {
                let uid = GetElement(data, 'a')
                
                GetOne(Account, {idUser: user.id, uid}).then(acc => {
                    UpdateOne(Account, {idUser: user.id, uid}, {
                        $set: {
                            "settings.craft": !acc.settings.craft
                        }
                    }).then(() => {
                        GetData(Account, {idUser: user.id}).then(accs => {
                            let kb = []
                            accs.forEach(acc => {
                                let ntext = acc.settings.craft ? `🔔` : `🔕`
                                let text = `${ntext} ${acc.game_nickname}`
                                let cb = `SetCraftAccTurn_a:${acc.uid}`
                                let btn = {
                                    text,
                                    callback_data: cb
                                }
                                kb.push(btn)
                            })
                            editText(text.params_turn_craft, chatId, message_id, [kb, ikb.cancel_params])
                        })
                    })
                })
            }
            
        break
    }
})
})

// -----------------------------
// Discord BOT для отображения информации по всем аккаунтам
const prefix = `!`
const dsrobot = new Client({intents: [ 
                                       GatewayIntentBits.Guilds,
                                       GatewayIntentBits.GuildBans,
                                       GatewayIntentBits.GuildEmojisAndStickers,
                                       GatewayIntentBits.GuildIntegrations,
                                       GatewayIntentBits.GuildInvites,
                                       GatewayIntentBits.GuildMembers,
                                       GatewayIntentBits.GuildPresences,
                                       GatewayIntentBits.GuildMessages,
                                       GatewayIntentBits.GuildMessageReactions,
                                       GatewayIntentBits.GuildEmojisAndStickers,
                                       GatewayIntentBits.GuildMessageTyping,

                                       GatewayIntentBits.DirectMessages,
                                       GatewayIntentBits.DirectMessageReactions,
                                       GatewayIntentBits.DirectMessageTyping,

                                       GatewayIntentBits.MessageContent,
                                     ]})

dsrobot.once(Events.ClientReady, () => {
    console.log(`${dsrobot.user.username} запущен!`)
    MAIN_CHANNEL = dsrobot.channels.cache.get(config.DISCORD_CHANNEL)
    if(!MAIN_CHANNEL) return console.log(`Channel не найден!`)
    
    resin = dsrobot.emojis.cache.find(emoji => emoji.name === "resin")
    cresin = dsrobot.emojis.cache.find(emoji => emoji.name === "cresin")
    rcur = dsrobot.emojis.cache.find(emoji => emoji.name === "rcur")
    primogem = dsrobot.emojis.cache.find(emoji => emoji.name === "primogem")
    transformer = dsrobot.emojis.cache.find(emoji => emoji.name === "transformer")
    stamina = dsrobot.emojis.cache.find(emoji => emoji.name === "tpow")
    reserve_stamina = dsrobot.emojis.cache.find(emoji => emoji.name === "rpow")
    
    MAIN_CHANNEL.messages.fetch({}).then(messages => {
        messages.forEach(message => {
            if (message.author.id == config.DISCORD_BOT_ID) {
                MESSAGE_ID = message.id
            }
        })
        delete_messages(MAIN_CHANNEL)
    })
    SendToDS(MAIN_CHANNEL)
})
async function SendToDS(channel) {
    await delete_messages(channel)
    try {
        GetData(Account, {showds: true}, {idUser: 1}).then(accs => {
            CheckDailyShortDS(accs).then(info => {
                let utcDate = moment.utc()
                let timeZone = 'Europe/Moscow'
                let localDate = utcDate.tz(timeZone)

                let updateTime = localDate.format('DD.MM HH:mm:ss')
                
                const embed = new EmbedBuilder()
                    .setColor('#ac38f5')
//                        .setTitle(`Инфа по всем аккаунтам`)
                    .setTitle(`Обновление ${updateTime}`)
//                        .setFooter({
//                            text: `Обновление в ${updateTime}`
//                        })
                
                    .setDescription(info)
                if (MESSAGE_ID) {
                    channel.messages.fetch(MESSAGE_ID).then(msg => {
                        msg.edit({embeds: [embed]})
                    })
                } else {
                    channel.send({embeds: [embed]})
                }
            })
        })
    } catch(error) {
        console.log(error)
    }
}
async function delete_messages(channel) {
    await channel.messages.fetch({}).then(messages => {
        let dels = messages.filter(mes => mes.id !== MESSAGE_ID)
        channel.bulkDelete(dels)
    })
}

dsrobot.login(config.DISCORD_BOT)


// -----------------------------
// FUNCTIONS
function Crypt(pas) {
    return crypto.createHash('sha512', pas).update(pas).digest('base64')
}
function CryptHEX(pas) {
    return crypto.createHash('sha512', pas).update(pas).digest('hex')
}

function GetDateTimeFull(date) {
    
    let day         = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
    let month       = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth()
    let year        = date.getFullYear()

    let hour        = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()
    let minute      = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()
    let second      = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()
    
    return `${day}.${month}.${year} ${hour}:${minute}:${second}`
}
function GetDateTime(date) {
    
    let day         = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
    let month       = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : date.getMonth()
    let year        = date.getFullYear()

    let hour        = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()
    let minute      = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()
    let second      = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()
    
    return `${day}.${month} ${hour}:${minute}:${second}`
}
function GetTimeFromHours(timestamp) {
    let hours = Math.floor(timestamp / 60 / 60)
    let minutes = Math.floor(timestamp / 60) - (hours * 60)
    let seconds = timestamp % 60

    let hour        = hours < 10 ? `0${hours}` : hours
    let minute      = minutes < 10 ? `0${minutes}` : minutes
    let second      = seconds < 10 ? `0${seconds}` : seconds
    
    return `${hour}:${minute}:${second}`
}
function Mapping(text) {
    // работает с 2я уровнями объектов
    let arr = Object.values(kb)
    arr.forEach((el) => {
        if (typeof el == 'object') {
            arr.slice(arr.indexOf(el))
            let na = Object.values(el)
            arr = arr.concat(na)
        }
    })
    return arr.indexOf(text) == -1
}

function Random(min, max) {
    return Math.floor(Math.random() * ((max + 1) - min)) + min
}
function GetSmile() {
    let ongoing = [`🧗‍♀️`, `🏊‍♂️`, `🪂`, `🚣‍♀️`, `🏃‍♀️`, `🏄`, `🏇`, `⛷`, `🚴`, `🏂`]
    return ongoing[Random(0, ongoing.length-1)]
}
function Toggle(t) {
    return t ? 1 : 0
}

function Setting(chatId, html, data) {
    sendHTMLi(chatId, html, [
        [
            {
                text: kb.settings.notify_on,
                callback_data: `SetY_${data}`
            },
            {
                text: kb.settings.notify_off,
                callback_data: `SetN_${data}`
            }
        ]
    ])
}

// FUNCTIONS FOR BOT
function cid(msg) { return msg.chat.id }
function GetText(cid) {
    return new Promise(function(resolve, reject) {
        bot.once('message', (msg) => {
            let text = msg.text
            let cid_2 = msg.chat.id
            if (cid == cid_2) {
                resolve(text)
            } else {
                GetText(cid).then(text_2 => {
                    resolve(text_2)
                })
            }
        })
    })
}

function sendHTML(chatId, html, kbName = null, parse_mode = 'HTML') {
    const options = {
        parse_mode
    }
    if (kbName) {
        options['reply_markup'] = {
            keyboard: keyboard[kbName],
            resize_keyboard: true
        }
    } else if (kbName == 'remove') {
        options['reply_markup'] = {
            remove_keyboard: true
        }
    }
    bot.sendMessage(chatId, html, options).then(msg => {
        resolve(msg)
    })
}
function sendHTML(chatId, html, kbName = null, parse_mode = 'HTML') {
    return new Promise(function(resolve, rejext) {
        const options = {
            parse_mode
        }
        if (kbName) {
            options['reply_markup'] = {
                keyboard: keyboard[kbName],
                resize_keyboard: true
            }
        } else if (kbName == 'remove') {
            options['reply_markup'] = {
                remove_keyboard: true
            }
        }
        bot.sendMessage(chatId, html, options).then(msg => {
            resolve(msg)
        })
    })
}

function sendHTMLi(chatId, html, kbName = null, parse_mode = 'HTML') {
    return new Promise(function(resolve, rejext) {
        const options = {
            parse_mode
        }
        
        if (typeof kbName == 'string') {
            options['reply_markup'] = {
                inline_keyboard: ikb[kbName]
            }
        }
        if (typeof kbName == 'object') {
            options['reply_markup'] = {
                inline_keyboard: kbName
            }
        }
        
//        console.log(typeof kbName)
        
        bot.sendMessage(chatId, html, options).then(msg => {
            resolve(msg)
        })
    })
}
function GetElement(str, el) {
    let string = ''
    let index1 = str.indexOf(`${el}:`)
    let s = str.substr(index1 + 1 + el.length, str.length)
    let index2 = s.indexOf(',')
    if (index2 != -1) {
        string = s.substr(0, index2)
    } else {
        string = s
    }
    return string
}
function Has(d, str) {
    return d.indexOf(str) == 0
}
function editText(text, chatId, messageId, ikbName = null, parse_mode = 'HTML') {
    return new Promise(function(resolve, reject) {
        const options = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode
        }
        if (ikbName) {
            if (typeof ikbName == 'string') {
                options['reply_markup'] = {
                    inline_keyboard: ikb[ikbName]
                }
            }
            if (typeof ikbName == 'object') {
                options['reply_markup'] = {
                    inline_keyboard: ikbName
                }
            }
        }
        bot.editMessageText(text, options).then(() => {
            resolve()
        })
    })
}
function editWait(text, chatId, messageId, ikbName = null, parse_mode = 'HTML') {
    return new Promise(function(resolve, reject) {
        const options = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode
        }
        if (ikbName) {
            if (typeof ikbName == 'string') {
                options['reply_markup'] = {
                    inline_keyboard: ikb[ikbName]
                }
            }
            if (typeof ikbName == 'object') {
                options['reply_markup'] = {
                    inline_keyboard: ikbName
                }
            }
        }
        bot.editMessageText(text, options).then(() => {
            GetText(chatId).then(text => {
                resolve(text)
            })
        })
    })
}

function sendWait(chatId, html, kbName = null, parse_mode = 'HTML') {
    return new Promise(function(resolve, rejext) {
        const options = {
            parse_mode
        }
        if (kbName) {
            options['reply_markup'] = {
                keyboard: keyboard[kbName],
                resize_keyboard: true
            }
        } else if (kbName == 'remove') {
            options['reply_markup'] = {
                remove_keyboard: true
            }
        }
        bot.sendMessage(chatId, html, options).then(() => {
            GetText(chatId).then(text => {
                resolve(text)
            })
        })
    })
}


// FUNCTIONS MIHOYO
//  https://bbs-api-os.mihoyo.com/game_record/genshin/api/dailyNote?server=os_euro&role_id=729476966
let urlDailyNote = `https://bbs-api-os.hoyolab.com/game_record/genshin/api/dailyNote`
let urlGameInfo = `https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard?uid=`

let urlDailyCheck = `https://sg-hk4e-api.hoyolab.com/event/sol/info?lang=ru-ru&act_id=`
let urlDailyCheckIn = `https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=ru-ru`
let act_id = `e202102251931481`


let urlDailyCheckHSR = `https://sg-public-api.hoyolab.com/event/luna/os/info?lang=ru-ru&act_id=e202303301540311`
let urlDailyCheckInHSR = `https://sg-public-api.hoyolab.com/event/luna/os/sign`
let act_id_hsr = `e202303301540311`

let urlPic = `https://upload-os-bbs.mihoyo.com/game_record/genshin/character_side_icon/UI_AvatarIcon_Side_`

let headers = {
    Host: "bbs-api-os.mihoyo.com",
    Accept: "*/*",
    "x-rpc-app_version": "1.5.0",
    Connection: "keep-alive",
    "x-rpc-client_type": "4",
    "Accept-Language": "ru",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBSOversea/2.25.0",
}

function checkCookies(ltuid, ltoken) {
    let cookie = `ltoken=${ltoken}; ltuid=${ltuid};`
    headers['Cookie'] = cookie
    
    return new Promise(function(resolve, reject) {
        axios({
            url: `${urlGameInfo}${ltuid}`,
            method: 'get',
            headers,
        }).then(res => {
//            console.log({list: res.data.data})
            resolve(res.data.data.list[0])
        }).catch(error => {
            console.error(error)
        })
    })
}
async function checkDailyNote(ltuid, ltoken) {
    let cookie = `ltoken=${ltoken}; ltuid=${ltuid};`
    headers['Cookie'] = cookie
    headers['DS'] = GenerateDS()
    return new Promise(function(resolve, reject) {
        checkCookies(ltuid, ltoken).then(profile => {
//            console.log(profile)
            axios({
                url: `${urlDailyNote}?server=${profile.region}&role_id=${profile.game_role_id}`,
                method: 'get',
                headers,
            }).then(res => {
                resolve(res.data.data)
            }).catch(error => {
                console.log(error)
            })
        })
    })
}
async function CheckDailyShortDS(array) {
    let accs_info = ``
    let now = new Date()
    let fields = []
    for (let account of array) {
            try {
                let tr = account.transformer
                let day = tr.Day == 0 ? '' : `${tr.Day} дн.`
                let hour = tr.Hour == 0 ? '' : `${tr.Hour} ч.`
                let minute = tr.Minute == 0 ? '' : `${tr.Minute} мин.`
                let second = tr.Second == 0 ? '' : `${tr.Second} сек.`
                let trans = tr.reached ? `Откатан` : `**${day} ${hour} ${minute} ${second}**`
                
                let resin_date = (account.resin_date.getTime() / 1000).toFixed(0)
                let coins_date = (account.coins_date.getTime() / 1000).toFixed(0)
                
//                console.log({
//                    resin_date,
//coins_date
//                })
                
//1682348940
//1682409433522

                let exps = account.expeditions
//                console.log({exps})
                let exps_info = ``
                let count_exps = 0
                exps.forEach((exp, n) => {
                    exp.status != 'Ongoing' ? count_exps++ : count_exps
                })
//                exps_info = count_exps != 0 ? `\n> Экспедиций: **${count_exps}**\n> ` : ''
                exps_info = count_exps != 0 ? `Экспедиций: **${count_exps}**` : ''
                
                let dailies = ``
                if (account.finished_task_num < 4) {
                    dailies = `Ежедневки: **${account.finished_task_num}**`
                }
                // hsr ------------
                let hsr_info = ``
                let exps_hsr = account.expeditions_hsr
                let exps_info_hsr = ``
                let count_exps_hsr = 0
                exps_hsr.forEach((exp, n) => {
                    exp.status != 'Ongoing' ? count_exps_hsr++ : count_exps_hsr
                })
                exps_info_hsr = count_exps_hsr != 0 ? `:scroll: **${count_exps_hsr}**` : ''
                let stamina_date = null
                if (account.hsr) {
                    stamina_date = (account.stamina_date.getTime() / 1000).toFixed(0)
                    let train = account.current_train_score != account.max_train_score ? `:book: ${account.current_train_score}` : ''
                    let rogue = account.current_rogue_score != account.max_rogue_score ? `:warning: ${account.current_rogue_score}/${account.max_rogue_score}` : ''
                    let cocoon = account.weekly_cocoon_cnt != 0 ? `:gem: ${account.weekly_cocoon_cnt}/${account.weekly_cocoon_limit}` : ''
                    let reserve = account.current_reserve_stamina != 0 ? `${reserve_stamina} ${account.current_reserve_stamina}` : ''
                    hsr_info = `> 
> ${stamina} **${account.stamina}** (<t:${stamina_date}:R>, <t:${stamina_date}:T>)      ${reserve}          ${exps_info_hsr}        ${train}    ${rogue}    ${cocoon}`
                }
                
                // ----------------
                
                let info = `

> ${primogem} Аккаунт ${account.game_nickname}
> ${resin} **${account.resin}**           ${cresin} **${account.condensed_resin}**          ${rcur} **${account.current_home_coin}**          ${transformer} **${trans}**      ${exps_info}      ${dailies}
> 
> Полная ${resin}: <t:${resin_date}:R> (<t:${resin_date}:D>, <t:${resin_date}:T>)
> Полные ${rcur}: <t:${coins_date}:R> (<t:${coins_date}:D>, <t:${coins_date}:T>)
${hsr_info}
`
                accs_info += info
            } catch(err) {
                console.log(err)
            }
    }
    return accs_info
}
// -----------------------------------------------
async function CheckArrayDailyShort(array) {
    let accs_info = ``
    let length = array.length
    let count = 0
    let now = new Date()
    for (let account of array) {
        await checkDailyNote(account.ltuid, account.ltoken).then(daily => {
//            console.log(daily)
            try {
                let resin_date = new Date(now.getTime() + (daily.resin_recovery_time * 1000))
                let coins_date = new Date(now.getTime() + (daily.home_coin_recovery_time * 1000))
                
                let dif_r = (resin_date - now) / 1000
                let dif_c = (coins_date - now) / 1000
                let res = `${formatNumb(distanceTime(dif_r).h)}:${formatNumb(distanceTime(dif_r).m)}:${formatNumb(distanceTime(dif_r).s)}`
                let coin = `${distanceTime(dif_c).d} дней ${formatNumb(distanceTime(dif_c).h)}:${formatNumb(distanceTime(dif_c).m)}:${formatNumb(distanceTime(dif_c).s)}`
                
                let div = length == count+1 ? `` : `————————————————————\n`
                let info = `👤 Аккаунт: <code>${account.game_nickname}</code>
${kb.settings.resin}: <b>${daily.current_resin}</b>
Полная смола через: <b>${res} (${GetDateTime(resin_date)})</b>

${kb.settings.realm_currency}: <b>${daily.current_home_coin}</b>
Полные монеты через: <b>${coin} (${GetDateTime(coins_date)})</b>
${div}`
                accs_info += info
                count++
            } catch(err) {
                console.log(err)
            }
        })
    }
    return accs_info
}
async function CheckArrayDailyFull(account) {
    let accs_info = ``
    let sleepS = `😴`
//    for (let account of array) {
        await checkDailyNote(account.ltuid, account.ltoken).then(daily => {
            try {
                let tr = daily.transformer.recovery_time
                let day = tr.Day == 0 ? '' : `${tr.Day} дн.`
                let hour = tr.Hour == 0 ? '' : `${tr.Hour} ч.`
                let minute = tr.Minute == 0 ? '' : `${tr.Minute} мин.`
                let second = tr.Second == 0 ? '' : `${tr.Second} сек.`
                let transformer = tr.reached ? `Откатан` : `<b>${day} ${hour} ${minute} ${second}</b>`
//                console.log(daily)
                let exps = daily.expeditions
                let exps_info = ``
                let smiles = []
                exps.forEach((exp, n) => {
                    let avatar_side_icon = exp.avatar_side_icon.replace(urlPic, '').replace('.png', '')
                    let status = exp.status == 'Ongoing' ? `В экспедиции` : `Экспедиция завершена`
                    let rt = +exp.remained_time
                    let remained_time = exp.status == 'Ongoing' ? `Осталось: <b>${GetTimeFromHours(rt)}</b>` : ``  // в часах, цифру делить на 60 и на 60
                    
                    let smile = ``
                    do {
                        smile = exp.status == 'Ongoing' ? GetSmile() : sleepS
                        smiles.push(smile)
                    } while (smiles.indexOf(smile) == -1)
                    exps_info += `---------- <b>${n+1}</b> ----------\n${smile} <b>${avatar_side_icon}</b> - <b>${status}</b>\n${remained_time}\n\n`
                })
                let info = `👤 Аккаунт: <b>${account.game_nickname}</b>

${kb.settings.resin}: <b>${daily.current_resin}</b>
${kb.time}: <b>${GetTimeFromHours(daily.resin_recovery_time)}</b>

🗞 Ежедневки: <b>${daily.finished_task_num}</b>/4
💳 Скидки на боссах: <b>${daily.remain_resin_discount_num}</b>

${kb.settings.realm_currency}: <b>${daily.current_home_coin}</b>
${kb.time}: <b>${GetTimeFromHours(daily.home_coin_recovery_time)}</b>

${kb.settings.transformer}: ${transformer}

Экспедиции
${exps_info}`
                accs_info += info
            } catch(err) {
                console.log(err)
            }
        })
//    }
    return accs_info
}
function GenerateDS() {
    const R = `fedcba`
    const DSSalt = `6cqshh5dhw73bzxn20oexa9k516chk7s`
    let epoch = (new Date() / 1000).toFixed(0)
    let hashOriginal = `salt=${DSSalt}&t=${epoch}&r=${R}`
    let hashCodes = crypto.createHash('md5').update(hashOriginal).digest("hex")
    return `${epoch},${R},${hashCodes}`
}

function distanceTime(seconds) {
    let d, h, m, s
    s = Math.floor(seconds % 60)
    m = Math.floor(seconds % 3600 / 60)
    h = Math.floor(seconds % 86400 / 3600)
    d = Math.floor(seconds / 86400)
    return { d: d, h: h, m: m, s: s }
}
function formatNumb(num) {
    return num < 10 ? `0${num}` : num
}
function DayStr(day) {
    let daystr = ''
    switch(day) {
        case 0:
            daystr = `Воскресенье`
        break
        case 1:
            daystr = `Понедельник`
        break
        case 2:
            daystr = `Вторник`
        break
        case 3:
            daystr = `Среда`
        break
        case 4:
            daystr = `Четверг`
        break
        case 5:
            daystr = `Пятница`
        break
        case 6:
            daystr = `Суббота`
        break
    }
    return daystr
}

//getInfoAccs()
async function getInfoAccs() {
    let now = new Date()
    let accounts = await GetData(Account, {});
    for (let account of accounts) {
        let daily = await checkDailyNote(account.ltuid, account.ltoken)

        if (daily) {
            let current_resin = daily.current_resin
            let tr = daily.transformer.recovery_time
            let coins = daily.current_home_coin
            let expeditions = daily.expeditions
            let finished_task_num = daily.finished_task_num
            
            let resin_date = new Date(now.getTime() + (daily.resin_recovery_time * 1000))
            let coins_date = new Date(now.getTime() + (daily.home_coin_recovery_time * 1000))
            
            let resin_recovery_time = daily.resin_recovery_time
            let home_coin_recovery_time = daily.home_coin_recovery_time
            
            UpdateOne(Account, {uid: account.uid}, {
                $set: {
                    "resin": current_resin,
                    "transformer.reached": tr.reached,
                    "transformer.Day": tr.Day,
                    "transformer.Hour": tr.Hour,
                    "transformer.Minute": tr.Minute,
                    "transformer.Second": tr.Second,
                    "current_home_coin": coins,
                    "resin_recovery_time": resin_recovery_time,
                    "home_coin_recovery_time": home_coin_recovery_time,
                    "resin_date": resin_date,
                    "coins_date": coins_date,
                    "expeditions": expeditions,
                    "finished_task_num": finished_task_num,
                }
            }).then(() => {
                
            }).catch(error => {
                console.error(error)
            })
            
        } else {
            console.log({msg: `Ошибка получения данных ${account.game_nickname} в СМОЛЕ и другом | ${GetDateTime(new Date())}`})
        }
    }
}



async function checkHSRNote(ltuid, ltoken, hsr_uid) {
    let cookie = `ltoken=${ltoken}; ltuid=${ltuid};`
    headers['Cookie'] = cookie
    headers['DS'] = GenerateDS()
    return new Promise(function(resolve, reject) {
//        checkCookies(ltuid, ltoken).then(profile => {
            axios({
                url: `https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note?server=prod_official_eur&role_id=${hsr_uid}`,
                method: 'get',
                headers,
            }).then(res => {
                resolve(res.data.data)
//                console.log(res.data.data)
            }).catch(error => {
                console.log(error)
            })
//        })
    })
}
async function getInfoAccsHSR() {
    let now = new Date()
    let accounts = await GetData(Account, {hsr: true,  });
    for (let account of accounts) {
        let daily = await checkHSRNote(account.ltuid, account.ltoken, account.hsr_uid)
        
        if (daily) {
            let current_stamina = daily.current_stamina
            let expeditions = daily.expeditions
            
            let stamina_recover_time = daily.stamina_recover_time
            let stamina_date = new Date(now.getTime() + (daily.stamina_recover_time * 1000))
            
//            console.log(daily)
            
            UpdateOne(Account, {uid: account.uid}, {
                $set: {
                    "stamina": current_stamina,
                    "stamina_date": stamina_date,
                    "expeditions_hsr": expeditions,
                    "current_rogue_score": daily.current_rogue_score,
                    "max_rogue_score": daily.max_rogue_score,
                    "current_train_score": daily.current_train_score,
                    "max_train_score": daily.max_train_score,
                    "weekly_cocoon_cnt": daily.weekly_cocoon_cnt,
                    "weekly_cocoon_limit": daily.weekly_cocoon_limit,
                    "current_reserve_stamina": daily.current_reserve_stamina,
                    "is_reserve_stamina_full": daily.is_reserve_stamina_full,
                }
            }).then(() => {
                
            }).catch(error => {
                console.error(error)
            })
            
        } else {
            console.log({msg: `Ошибка получения данных ${account.game_nickname} в СТАМИНЕ и другом ХСР | ${GetDateTime(new Date())}`})
        }
    }
}


async function SendHSR() {
    try {
        let accs = await GetData(Account, {hsr: true}, {idUser: 1})
        for (let acc of accs) {
            let user = await GetOne(User, {id: acc.idUser})
            
            let now = moment().tz('Europe/Moscow').startOf('minute')
            let time = moment(acc.hsr_date).tz('Europe/Moscow').startOf('minute')
            
            let dif = now.isSame(time)
            
            if (dif) {
                sendHTML(user.chatId, `Смола у \`${acc.game_nickname}\` (\`${acc.hsr_uid}\`) в HSR \`160 - 170\` или больше!`, null, 'Markdown')
            }
        }
    } catch(error) {
        console.log(error)
    }
}
async function NotifyOne() {
    let accounts = await GetData(Account, {});
    for (let account of accounts) {
        let user = await GetOne(User, {id: account.idUser});
        let aset = account.settings
        let acc = `👤 Аккаунт: <b>${account.game_nickname}</b>\n\n`
        let message = ``
        
        let day = new Date().getDay()
        
        if (day == account.notify.day) {
            message = account.notify.message
        }
        
        if (message) {
            acc += message
            sendHTML(user.chatId, acc)
            UpdateOne(Account, {uid: account.uid}, {
                $set: {
                    "notify.day": -1,
                    "notify.message": ''
                }
            })
        }
    }
}
async function sendBroadcast(query) {
    let accounts = await GetData(Account, query);
    for (let account of accounts) {
        let user = await GetOne(User, {id: account.idUser});
        let uset = user.settings
        let aset = account.settings
        let acc = `👤 Аккаунт: <b>${account.game_nickname}</b>\n`
        let message = ``

        let current_resin = account.resin

//        ОБРАБОТКА ПОСЕВОВ НИЖЕ
//        if (user.settings.notifications && user.settings.seeding && daily.current_home_coin >= account.settings.seeding) {
//            message += `${kb.settings.realm_currency}: <code>${daily.current_home_coin}</code>\n`
//        }

        if (uset.notifications && uset.resin_each_40 && current_resin % 40 == 0 && current_resin != 0) {
            message += `Сейчас смолы: <code>${current_resin}</code>\n`
        }
        if (uset.notifications && uset.resin_140 && current_resin == 140 ) {
            message += `Смолы 140 ❗️\n`
        }
        if (uset.notifications && uset.resin_150 && current_resin == 150 ) {
            message += `Смолы 150 ❗️\n`
        }
        if (uset.notifications && uset.resin_which && current_resin == aset.resin_which) {
            message += `Смола достигла отметки <code>${aset.resin_which}</code>\n`
        }
        if (uset.notifications && uset.resin_overflow && (current_resin+1) >= 160) {
            message += `❗️❗️❗️❗️❗️ ПЕРЕКАП ❗️❗️❗️❗️❗️\n`
        }

        let tr = account.transformer

        if (uset.notifications && uset.transformer 
            && (!tr.reached && tr.Day === 0 && tr.Hour === 0 && ((tr.Minute < aset.transformer_mins) || 
            (tr.reached && aset.transformer_mins != -1)))
        ) {
            message += `У преобразователя осталось меньше ${aset.transformer_mins} минут либо он откатан\n\n`
        }

        if (uset.notifications && uset.expeditions && aset.expeditions) {
            let msg = ''
            for (let i = 0; i < account.expeditions.length; i++) {
                if(account.expeditions[i].status === 'Finished') {
                    msg += `Экспедиция с персонажем <code>${account.expeditions[i].avatar_side_icon.replace(urlPic, '').replace('.png', '')}</code> завершена\n`
                }
            }
            if (msg) {
                message += `Экспедиции\n`
                message += msg
            }
        }
        if (message) {
            acc += message
            sendHTML(user.chatId, acc)
        }
    }
}
async function sendBroadcastRealmCurrency(query) {
    let accounts = await GetData(Account, query);
    for (let account of accounts) {
        let user = await GetOne(User, {id: account.idUser});
        let uset = user.settings
        let aset = account.settings
//        let daily = await checkDailyNote(account.ltuid, account.ltoken);
        let acc = `👤 Аккаунт: <b>${account.game_nickname}</b>\n`
        let message = ``
//        console.log({pot: daily})
        
//        console.log({chc: daily.current_home_coin, acc: account.game_nickname})
//        console.log(daily.current_home_coin >= aset.current_home_coin)
        if (uset.notifications && uset.realm_currency && account.current_home_coin >= aset.current_home_coin) {
            message += `${kb.settings.realm_currency}: <code>${account.current_home_coin}</code>\n`
        }

        if (message) {
            acc += message
            sendHTML(user.chatId, acc)
        }
    }
}

async function sendBroadcastDailyTasks(query) {
    let accounts = await GetData(Account, query);
    for (let account of accounts) {
        let user = await GetOne(User, {id: account.idUser});
        let uset = user.settings
        let aset = account.settings
//        let daily = await checkDailyNote(account.ltuid, account.ltoken);
        let acc = `👤 Аккаунт: <b>${account.game_nickname}</b>\n`
        let message = ``
        
        if (uset.notifications && uset.settings.dailies && aset.settings.dailies && account.finished_task_num == 0) {
            message += `Есть недоделанные 🗞 Ежедневки: <b>${account.finished_task_num}</b>/4`
        }

        if (message) {
            acc += message
            sendHTML(user.chatId, acc)
        }
    }
}


function dailyCheckIn(ltuid, ltoken) {
    let cookie = `ltoken=${ltoken}; ltuid=${ltuid};`
    let headers = {
        "accept": "application/json, text/plain, */*",
        "cookie": cookie
    }
    return new Promise(function(resolve, reject) {
        try {
            axios({
                url: `${urlDailyCheck}${act_id}`,
                method: 'get',
                headers
            }).then(res => {
//                console.log({r: res.data.data, i: res.data.data != null})
                if (res.data.data != null) {
                    let status = res.data.data.is_sign
                    if (!status) {
        //                console.log({ltuid, status})
                        axios({
                            url: `${urlDailyCheckIn}`,
                            method: 'post',
                            headers,
                            data: JSON.stringify({act_id: act_id})
                        }).then(res => {

        //                    console.log({ltuid, status})
        //                    console.log(`---------------------------------------------------------`)
        //                    if (res.data.data.code == 'ok') {
        //                        console.log({data: res.data, ltuid})
                                resolve(res.data.data.code)

        //                    }
                        }).catch(error => {
                            console.log(error)
                        })
                    }
                }
            })
        } catch(error) {
            console.error(error)
        }
    })
}
function CheckIn() {
GetData(User, {}).then(users => {
  const promises = users.map(user => {
    return GetData(Account, {idUser: user.id}).then(accs => {
      let text = ""
      const promisesCheckIn = accs.map(account => {
        
        return dailyCheckIn(account.ltuid, account.ltoken).then(ok => {
            if (ok === "ok") {
                text += `Отметка в аккаунте <code>${account.game_nickname}</code> успешна!\n`
            }
        })
          
      })
      return Promise.all(promisesCheckIn).then(() => {
        if (user.settings.notifications && user.settings.checkin) {
          return sendHTML(user.chatId, text)
        }
      })
    })
  })
  return Promise.all(promises)
})
    
}


// hsr
// https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?t=1690404700421&lang=ru&game_biz=hkrpg_global&uid=700022211&region=prod_official_eur&cdkey=ASSAFAFS


// genshin
// https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?uid=707416118&region=os_euro&lang=ru&cdkey=vhgjghjg&game_biz=hk4e_global&sLangKey=en-us

function giftCodeGI(uid, promocode) {
return new Promise(function(resolve, reject) {
    GetOne(Account, {uid}).then(account => {
        
        let cookie = `cookie_token=${account.cookie}; account_id=${account.ltuid}; cookie_token_v2=${account.cookie_v2}; account_mid_v2=${account.account_mid_v2};`
        
        let headers = {
            "accept": "application/json, text/plain, */*",
            "cookie": cookie
        }
        
            axios({
                url: `https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?uid=${uid}&region=os_euro&lang=ru&cdkey=${promocode}&game_biz=hk4e_global&sLangKey=en-us`,
                method: 'get',
                headers,
            }).then(res => {
//                console.log(res.data)
                resolve(res.data)
            }).catch(error => {
                console.log(error)
            })
        })
        
    })
}

function giftCodeHSR(hsr_uid, promocode) {
return new Promise(function(resolve, reject) {
    GetOne(Account, {hsr_uid}).then(account => {
        
        let cookie = `cookie_token=${account.cookie}; account_id=${account.ltuid}; cookie_token_v2=${account.cookie_v2}; account_mid_v2=${account.account_mid_v2};`
        
        let headers = {
            "accept": "application/json, text/plain, */*",
            "cookie": cookie
        }
        
            axios({
                url: `https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?t=${moment().valueOf()}&lang=ru&game_biz=hkrpg_global&uid=${hsr_uid}&region=prod_official_eur&cdkey=${promocode}`,
                method: 'get',
                headers,
            }).then(res => {
//                console.log(res.data)
                resolve(res.data)
            }).catch(error => {
                console.log(error)
            })
        })
        
    })
}

// -------------------------------------------------------------------
function dailyCheckInHSR(ltuid, ltoken) {
    let cookie = `ltoken=${ltoken}; ltuid=${ltuid};`
    let headers = {
        "accept": "application/json, text/plain, */*",
        "cookie": cookie,
        "accept-language": `ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7`,
    }
    return new Promise(function(resolve, reject) {
        axios({
            url: `${urlDailyCheckHSR}`,
            method: 'get',
            headers
        }).then(res => {
            let status = res.data.data.is_sign
            
            if (!status) {
                axios({
                    url: `${urlDailyCheckInHSR}`,
                    method: 'post',
                    headers,
                    data: JSON.stringify({act_id: act_id_hsr})
                }).then(res => {
                    resolve(res.data.message)
                }).catch(error => {
                    console.log(error)
                })
            }
        })
    })
}
function CheckInHSR() {
GetData(User, {}).then(users => {
  const promises = users.map(user => {
    return GetData(Account, {idUser: user.id, hsr: true}).then(accs => {
      let text = "Отметки HSR\n\n"
      const promisesCheckIn = accs.map(account => {
        return dailyCheckInHSR(account.ltuid, account.ltoken).then(ok => {
          if (ok === "OK") {
            text += `Отметка в аккаунте <code>${account.game_nickname}</code> (<code>${account.hsr_uid}</code>) успешна!\n`
          }
        })
          
//            await new Promise(r => setTimeout(r, 1000));
      })
      return Promise.all(promisesCheckIn).then(() => {
        if (user.settings.notifications && user.settings.checkin) {
          return sendHTML(user.chatId, text)
        }
      })
    })
  })
  return Promise.all(promises)
})
}

// https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note?server=prod_official_eur&role_id=


// Функции для работы с БД
function GetData(Model, query = {}, sort = {}, skip = 0, limit = 0) {
    return new Promise(function(resolve, reject) {
        if (limit != 0) {
            Model.find(query).sort(sort).limit(limit).then(arr => {
                resolve(arr)
            })
        } else {
            Model.find(query).sort(sort).then(arr => {
                resolve(arr)
            })
        }
    })
}
function GetOne(Model, query = {}, sort = {}) {
    return new Promise(function(resolve, reject) {
        Model.findOne(query).sort(sort).then(el => {
            resolve(el)
        })
    })
}
function NewDataId(Model, data = {}) {
    return new Promise(function(resolve, reject) {
        Model.findOne({}).sort({id: -1}).then(last => {
            let id = !last ? 1 : last.id + 1
            data.id = id
            let newData = new Model(data)
            newData.save().then(() => {
                resolve()
            }).catch(error => {
                reject(error)
            })
        })
    })
}
function NewData(Model, data = {}) {
    return new Promise(function(resolve, reject) {
        let newData = new Model(data)
        newData.save().then(() => {
            resolve()
        }).catch(error => {
            reject(error)
        })
    })
}
function UpdateOne(Model, query = {}, new_data = {}) {
    return new Promise(function(resolve, reject) {
        Model.updateOne(query, new_data).then(() => {
            resolve()
        }).catch(error => {
            reject(error)
        })
    })
}
function RemoveOne(Model, query = {}) {
    return new Promise(function(resolve, reject) {
        Model.deleteOne(query).then(() => {
            resolve()
        }).catch(error => {
            reject(error)
        })
    })
}
function RemoveMany(Model, query = {}) {
    return new Promise(function(resolve, reject) {
        Model.deleteMany(query).then(() => {
            resolve()
        }).catch(error => {
            reject(error)
        })
    })
}