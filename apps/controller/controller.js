const soap = require('soap');
const moment = require('moment');
moment.locale('en');

const mellatWsdl = "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl";
const PgwSite = "https://bpm.shaparak.ir/pgwchannel/startpay.mellat";
const callBackUrl =process.env.callBackUrl;
const terminalId = +process.env.terminalId;
const userName = "agridayan";
const userPassword = process.env.userPassword;



const payment = async (req,res)=>{
    try {
        if(req.query.amount) {
            const amount = +req.query.amount;
            const orderId = +(moment().valueOf());

            let payRequestResult = await bpPayRequest(orderId, amount, 'ok', callBackUrl);
            console.log(payRequestResult);
            payRequestResult = payRequestResult.return;
            payRequestResult = payRequestResult.split(",");

            if(parseInt(payRequestResult[0]) === 0) {
                let bankRespond = {
                    url:PgwSite,
                    RefId:payRequestResult[1]};
                res.status(200).json(bankRespond);
            }else {
                if(payRequestResult[0] === null) {
                    return res.status(400).json({error: 'هیچ شماره پیگیری برای پرداخت از سمت بانک ارسال نشده است!'});
                }else {
                    let error = responseContentByStatus(parseInt(payRequestResult[0]));
                    return res.status(400).json({error});
                }
            }
        } else {
            return res.status(422).json({error: 'مبلغ قابل پرداخت وارد کنید.'});
        }

    } catch (e){
        console.log(e);
    }

}



function bpPayRequest (orderId, amount, additionalData, callBackUrl) {
    const localDate = moment().format('YYYYMMDD');
    const localTime = moment().format('HHmmss');
    const args = {
        terminalId,
        userName,
        userPassword,
        orderId,
        amount,
        localDate,
        localTime,
        additionalData,
        callBackUrl,
        payerId: 0
    };

    let options = {
        overrideRootElement: {
            namespace: 'ns1'
        }
    };

    return new Promise ((resolve, reject) => {
        soap.createClient(mellatWsdl, options, (err, client) => {
            client.bpPayRequest(args, (err, result, body) => {
                if(err) {
                    console.log(err);
                    reject(err);
                }
                return resolve(result);
            })
        });
    });
}






function responseContentByStatus(status){
    const mellatBankReturnCode =
        {
            0 :'ﺗﺮاﻛﻨﺶ_ﺑﺎ_ﻣﻮﻓﻘﻴﺖ_اﻧﺠﺎم_ﺷﺪ',
            11: 'ﺷﻤﺎره_ﻛﺎرت_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            12: 'ﻣﻮﺟﻮدي_ﻛﺎﻓﻲ_ﻧﻴﺴﺖ',
            13: 'رﻣﺰ_ﻧﺎدرﺳﺖ_اﺳﺖ',
            14: 'ﺗﻌﺪاد_دﻓﻌﺎت_وارد_ﻛﺮدن_رﻣﺰ_ﺑﻴﺶ_از_ﺣﺪ_ﻣﺠﺎز_اﺳﺖ',
            15:'ﻛﺎرت_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            16: 'دﻓﻌﺎت_ﺑﺮداﺷﺖ_وﺟﻪ_ﺑﻴﺶ_از_ﺣﺪ_ﻣﺠﺎز_اﺳﺖ',
            17:'ﻛﺎرﺑﺮ_از_اﻧﺠﺎم_ﺗﺮاﻛﻨﺶ_ﻣﻨﺼﺮف_ﺷﺪه_اﺳﺖ',
            18:'ﺗﺎرﻳﺦ_اﻧﻘﻀﺎي_ﻛﺎرت_ﮔﺬﺷﺘﻪ_اﺳﺖ',
            19:'ﻣﺒﻠﻎ_ﺑﺮداﺷﺖ_وﺟﻪ_ﺑﻴﺶ_از_ﺣﺪ_ﻣﺠﺎز_اﺳﺖ',
            111: 'ﺻﺎدر_ﻛﻨﻨﺪه_ﻛﺎرت_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            112:'ﺧﻄﺎي_ﺳﻮﻳﻴﭻ_ﺻﺎدر_ﻛﻨﻨﺪه_ﻛﺎرت',
            113:'ﭘﺎﺳﺨﻲ_از_ﺻﺎدر_ﻛﻨﻨﺪه_ﻛﺎرت_درﻳﺎﻓﺖ_ﻧﺸﺪ',
            114:'دارﻧﺪه_ﻛﺎرت_ﻣﺠﺎز_ﺑﻪ_اﻧﺠﺎم_اﻳﻦ_ﺗﺮاﻛﻨﺶ_ﻧﻴﺴﺖ',
            21:'ﭘﺬﻳﺮﻧﺪه_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            23:'ﺧﻄﺎي_اﻣﻨﻴﺘﻲ_رخ_داده_اﺳﺖ',
            24:'اﻃﻼﻋﺎت_ﻛﺎرﺑﺮي_ﭘﺬﻳﺮﻧﺪه_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            25:'ﻣﺒﻠﻎ_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            31:'ﭘﺎﺳﺦ_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            32:'ﻓﺮﻣﺖ_اﻃﻼﻋﺎت_وارد_ﺷﺪه_ﺻﺤﻴﺢ_ﻧﻤﻲ_ﺑﺎﺷﺪ',
            33:'ﺣﺴﺎب_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            34:'ﺧﻄﺎي_ﺳﻴﺴﺘﻤﻲ',
            35:'ﺗﺎرﻳﺦ_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            41:'ﺷﻤﺎره_درﺧﻮاﺳﺖ_ﺗﻜﺮاري_اﺳﺖ',
            42: 'ﺗﺮاﻛﻨﺶ_Sale_یافت_نشد_',
            43: 'ﺒﻼ_Verify_درﺧﻮاﺳﺖ_داده_ﺷﺪه_اﺳﺖ',
            44: 'درخواست_verify_یافت_نشد',
            45: 'ﺗﺮاﻛﻨﺶ_Settle_ﺷﺪه_اﺳﺖ',
            46: 'ﺗﺮاﻛﻨﺶ_Settle_نشده_اﺳﺖ',
            47: 'ﺗﺮاﻛﻨﺶ_Settle_یافت_نشد',
            48: 'تراکنش_Reverse_شده_است',
            49: 'تراکنش_Refund_یافت_نشد',
            412: 'شناسه_قبض_نادرست_است',
            413: 'ﺷﻨﺎﺳﻪ_ﭘﺮداﺧﺖ_ﻧﺎدرﺳﺖ_اﺳﺖ',
            414: 'سازﻣﺎن_ﺻﺎدر_ﻛﻨﻨﺪه_ﻗﺒﺾ_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            415: 'زﻣﺎن_ﺟﻠﺴﻪ_ﻛﺎري_ﺑﻪ_ﭘﺎﻳﺎن_رسیده_است',
            416: 'ﺧﻄﺎ_در_ﺛﺒﺖ_اﻃﻼﻋﺎت',
            417: 'ﺷﻨﺎﺳﻪ_ﭘﺮداﺧﺖ_ﻛﻨﻨﺪه_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            418: 'اﺷﻜﺎل_در_ﺗﻌﺮﻳﻒ_اﻃﻼﻋﺎت_ﻣﺸﺘﺮي',
            419: 'ﺗﻌﺪاد_دﻓﻌﺎت_ورود_اﻃﻼﻋﺎت_از_ﺣﺪ_ﻣﺠﺎز_ﮔﺬﺷﺘﻪ_اﺳﺖ',
            421: 'IP_نامعتبر_است' ,
            51: 'ﺗﺮاﻛﻨﺶ_ﺗﻜﺮاري_اﺳﺖ',
            54: 'ﺗﺮاﻛﻨﺶ_ﻣﺮﺟﻊ_ﻣﻮﺟﻮد_ﻧﻴﺴﺖ',
            55: 'ﺗﺮاﻛﻨﺶ_ﻧﺎﻣﻌﺘﺒﺮ_اﺳﺖ',
            61: 'ﺧﻄﺎ_در_واریز'
        };

    if(mellatBankReturnCode[status]) {
        return mellatBankReturnCode[status+''];
    } else {
        return '';
    }
   // let response = Object.keys(mellatBankReturnCode).map(item=>{
   //      return
   //  })
}




module.exports = {
    payment
}