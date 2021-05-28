const soap = require('soap');
const moment = require('moment');
moment.locale('en');

const mellatWsdl = "https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl";
const PgwSite = "https://bpm.shaparak.ir/pgwchannel/startpay.mellat";
const callBackUrl ='http://agrodayan.ir/pay/callbackmellat';
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
                //  "mobileNo" سمت کلاینت لطفا به این آبجکت درصورت وجود شماره موبایل اضافه شود با این کلید
                //example ==> let mobileNo = 989121231111;
                let bankRespond = {
                    url:PgwSite,
                    RefId:payRequestResult[1]};

                // res.status(200).json(bankRespond);
                return res.render('redirect_vpos.ejs', {bank_url: PgwSite, RefId: payRequestResult[1]})
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
        res.status(400).end(JSON.stringify(e));
    }

}

const callBackMellat = async (req,res)=>{
    try {

        let Run_bpReversalRequest = false;
        let saleReferenceId = -999;
        let saleOrderId = -999;
        let resultCode_bpPayRequest;

        if (req.body.ResCode === null || req.body.SaleOrderId === null
            || req.body.SaleReferenceId === null || req.body.CardHolderPan === null) {
            return res.status(422).json({error: 'پارامترهای لازم از طرف بانک ارسال نشد.'});
        }
        saleReferenceId = parseInt(req.body.SaleReferenceId, 10);
        saleOrderId = parseInt(req.body.SaleOrderId, 10);
        resultCode_bpPayRequest = parseInt(req.body.ResCode);
        const cardHolderPan = req.body.CardHolderPan;
        console.log(req.body);

        //Result Code
        let resultCode_bpinquiryRequest = "-9999";
        let resultCode_bpSettleRequest = "-9999";
        let resultCode_bpVerifyRequest = "-9999";

        if (resultCode_bpPayRequest === 0) {
            //verify request
            resultCode_bpVerifyRequest = await bpVerifyRequest(saleOrderId, saleOrderId, saleReferenceId);
            resultCode_bpVerifyRequest = resultCode_bpVerifyRequest.return;
            console.log('bpVerifyRequest:' + resultCode_bpVerifyRequest);

            if (resultCode_bpVerifyRequest === null || resultCode_bpVerifyRequest.length === 0) {
                //Inquiry Request
                resultCode_bpinquiryRequest = await bpInquiryRequest(saleOrderId, saleOrderId, saleReferenceId);
                resultCode_bpinquiryRequest = parseInt(resultCode_bpinquiryRequest.return);
                console.log('bpinquiryRequest' + resultCode_bpinquiryRequest);

                if (resultCode_bpinquiryRequest !== 0) {
                    let resultReversePay = await bpReversalRequest(saleOrderId, saleOrderId, saleReferenceId);
                    resultReversePay = resultReversePay.return;
                    console.log(resultReversePay);
                    const error = responseContentByStatus(resultCode_bpinquiryRequest);
                    return res.render('mellat_payment_result.ejs', {error});
                }
            }

            if (parseInt(resultCode_bpVerifyRequest) === 0 || resultCode_bpinquiryRequest === 0) {
                //SettleRequest
                resultCode_bpSettleRequest = await bpSettleRequest(saleOrderId, saleOrderId, saleReferenceId);
                resultCode_bpSettleRequest = parseInt(resultCode_bpSettleRequest.return);
                console.log('bpSettleRequest' + resultCode_bpSettleRequest);

                //ﺗﺮاﻛﻨﺶ_Settle_ﺷﺪه_اﺳﺖ
                //ﺗﺮاﻛﻨﺶ_ﺑﺎ_ﻣﻮﻓﻘﻴﺖ_اﻧﺠﺎم_ﺷﺪ
                if (resultCode_bpSettleRequest === 0 || resultCode_bpSettleRequest === 45) {
                    //success payment
                    let msg = ' تراکنش شما با موفقیت انجام شد ';
                    msg += "شماره پیگیری :" + saleReferenceId;
                    //save success payment into db
                    console.log(msg);
                    // return res.status(200).json({message:msg})
                    return res.render('mellat_payment_result.ejs', {msg});
                }
            } else {
                if (saleOrderId != -999 && saleReferenceId != -999) {
                    if (resultCode_bpPayRequest !== 17) {
                        let resultReversePay = await bpReversalRequest(saleOrderId, saleOrderId, saleReferenceId);
                        resultReversePay = resultReversePay.return;
                        console.log(resultReversePay);
                    }

                }

                const error = responseContentByStatus(resultCode_bpVerifyRequest);
                // return res.status(400).json({error:error});
                return res.render('mellat_payment_result.ejs', {error});
            }
        } else {
            if (saleOrderId != -999 && saleReferenceId != -999) {
                if (resultCode_bpPayRequest !== 17) {
                    let resultReversePay = await bpReversalRequest(saleOrderId, saleOrderId, saleReferenceId);
                    resultReversePay = resultReversePay.return;
                    console.log(resultReversePay);
                }
                const error = responseContentByStatus(resultCode_bpPayRequest);
                // return res.status(400).json({error:error});
                return res.render('mellat_payment_result.ejs', {error});
            }
        }
    }
    catch (e)
    {
        console.log(e);
        res.status(400).end(JSON.stringify(e));
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
            0 :'ﺗﺮاﻛﻨﺶ ﺑﺎ ﻣﻮﻓﻘﻴﺖ اﻧﺠﺎم ﺷﺪ',
            11: 'ﺷﻤﺎره ﻛﺎرت ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            12: 'ﻣﻮﺟﻮدي ﻛﺎﻓﻲ ﻧﻴﺴﺖ',
            13: 'رﻣﺰ ﻧﺎدرﺳﺖ اﺳﺖ',
            14: 'ﺗﻌﺪاد دﻓﻌﺎت وارد ﻛﺮدن رﻣﺰ ﺑﻴﺶ از ﺣﺪ ﻣﺠﺎز اﺳﺖ',
            15:'ﻛﺎرت ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            16: 'دﻓﻌﺎت ﺑﺮداﺷﺖ وﺟﻪ ﺑﻴﺶ از ﺣﺪ ﻣﺠﺎز اﺳﺖ',
            17:'ﻛﺎرﺑﺮ از اﻧﺠﺎم ﺗﺮاﻛﻨﺶ ﻣﻨﺼﺮف ﺷﺪه اﺳﺖ',
            18:'ﺗﺎرﻳﺦ اﻧﻘﻀﺎي ﻛﺎرت ﮔﺬﺷﺘﻪ اﺳﺖ',
            19:'ﻣﺒﻠﻎ ﺑﺮداﺷﺖ وﺟﻪ ﺑﻴﺶ از ﺣﺪ ﻣﺠﺎز اﺳﺖ',
            111: 'ﺻﺎدر ﻛﻨﻨﺪه ﻛﺎرت ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            112:'ﺧﻄﺎي ﺳﻮﻳﻴﭻ ﺻﺎدر ﻛﻨﻨﺪه ﻛﺎرت',
            113:'ﭘﺎﺳﺨﻲ از ﺻﺎدر ﻛﻨﻨﺪه ﻛﺎرت درﻳﺎﻓﺖ ﻧﺸﺪ',
            114:'دارﻧﺪه ﻛﺎرت ﻣﺠﺎز ﺑﻪ اﻧﺠﺎم اﻳﻦ ﺗﺮاﻛﻨﺶ ﻧﻴﺴﺖ',
            21:'ﭘﺬﻳﺮﻧﺪه ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            23:'ﺧﻄﺎي اﻣﻨﻴﺘﻲ رخ داده اﺳﺖ',
            24:'اﻃﻼﻋﺎت ﻛﺎرﺑﺮي ﭘﺬﻳﺮﻧﺪه ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            25:'ﻣﺒﻠﻎ ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            31:'ﭘﺎﺳﺦ ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            32:'ﻓﺮﻣﺖ اﻃﻼﻋﺎت وارد ﺷﺪه ﺻﺤﻴﺢ ﻧﻤﻲ ﺑﺎﺷﺪ',
            33:'ﺣﺴﺎب ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            34:'ﺧﻄﺎي ﺳﻴﺴﺘﻤﻲ',
            35:'ﺗﺎرﻳﺦ ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            41:'ﺷﻤﺎره درﺧﻮاﺳﺖ ﺗﻜﺮاري اﺳﺖ',
            42: 'ﺗﺮاﻛﻨﺶ یافت نشد ',
            43: 'ﺒﻼ درﺧﻮاﺳﺖ داده ﺷﺪه اﺳﺖ',
            44: 'درخواست یافت نشد',
            45: 'ﺗﺮاﻛﻨﺶ ﺷﺪه اﺳﺖ',
            46: 'ﺗﺮاﻛﻨﺶ نشده اﺳﺖ',
            47: 'ﺗﺮاﻛﻨﺶ یافت نشد',
            48: 'تراکنش شده است',
            49: 'تراکنش یافت نشد',
            412: 'شناسه قبض نادرست است',
            413: 'ﺷﻨﺎﺳﻪ ﭘﺮداﺧﺖ ﻧﺎدرﺳﺖ اﺳﺖ',
            414: 'سازﻣﺎن ﺻﺎدر ﻛﻨﻨﺪه ﻗﺒﺾ ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            415: 'زﻣﺎن ﺟﻠﺴﻪ ﻛﺎري ﺑﻪ ﭘﺎﻳﺎن رسیده است',
            416: 'ﺧﻄﺎ در ﺛﺒﺖ اﻃﻼﻋﺎت',
            417: 'ﺷﻨﺎﺳﻪ ﭘﺮداﺧﺖ ﻛﻨﻨﺪه ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            418: 'اﺷﻜﺎل در ﺗﻌﺮﻳﻒ اﻃﻼﻋﺎت ﻣﺸﺘﺮي',
            419: 'ﺗﻌﺪاد دﻓﻌﺎت ورود اﻃﻼﻋﺎت از ﺣﺪ ﻣﺠﺎز ﮔﺬﺷﺘﻪ اﺳﺖ',
            421: 'IP نامعتبر است' ,
            51: 'ﺗﺮاﻛﻨﺶ ﺗﻜﺮاري اﺳﺖ',
            54: 'ﺗﺮاﻛﻨﺶ ﻣﺮﺟﻊ ﻣﻮﺟﻮد ﻧﻴﺴﺖ',
            55: 'ﺗﺮاﻛﻨﺶ ﻧﺎﻣﻌﺘﺒﺮ اﺳﺖ',
            61: 'ﺧﻄﺎ در واریز'
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

function bpVerifyRequest (orderId, saleOrderId, saleReferenceId) {
    const args = {
        terminalId: terminalId,
        userName: userName,
        userPassword: userPassword,
        orderId: orderId,
        saleOrderId: saleOrderId,
        saleReferenceId: saleReferenceId,
    };

    let options = {
        overrideRootElement: {
            namespace: 'ns1'
        }
    };

    return new Promise ((resolve, reject) => {
        soap.createClient(mellatWsdl, options, (err, client) => {
            client.bpVerifyRequest(args, (err, result, body) => {

                if(err) {
                    //console.log(err);
                    reject(err);
                }
                console.log(`result from verify : ${result}`)
                return resolve(result);
            })
        });
    });
}
function bpInquiryRequest (orderId, saleOrderId, saleReferenceId) {
    const args = {
        terminalId: terminalId,
        userName: userName,
        userPassword: userPassword,
        orderId: orderId,
        saleOrderId: saleOrderId,
        saleReferenceId: saleReferenceId,
    };

    let options = {
        overrideRootElement: {
            namespace: 'ns1'
        }
    };

    return new Promise ((resolve, reject) => {
        soap.createClient(mellatWsdl, options, (err, client) => {
            client.bpInquiryRequest(args, (err, result, body) => {

                if(err) {
                    //console.log(err);
                    reject(err);
                }
                console.log(`message from inquiry func : ${result}`)
                return resolve(result);
            })
        });
    });
}

function bpReversalRequest (orderId, saleOrderId, saleReferenceId) {
    const args = {
        terminalId: terminalId,
        userName: userName,
        userPassword: userPassword,
        orderId: orderId,
        saleOrderId: saleOrderId,
        saleReferenceId: saleReferenceId,
    };

    let options = {
        overrideRootElement: {
            namespace: 'ns1'
        }
    };

    return new Promise ((resolve, reject) => {
        soap.createClient(mellatWsdl, options, (err, client) => {
            client.bpReversalRequest(args, (err, result, body) => {

                if(err) {
                    //console.log(err);
                    reject(err);
                }
                return resolve(result);
            })
        });
    });
}
function bpSettleRequest (orderId, saleOrderId, saleReferenceId) {
    const args = {
        terminalId: terminalId,
        userName: userName,
        userPassword: userPassword,
        orderId: orderId,
        saleOrderId: saleOrderId,
        saleReferenceId: saleReferenceId,
    };

    let options = {
        overrideRootElement: {
            namespace: 'ns1'
        }
    };

    return new Promise ((resolve, reject) => {
        soap.createClient(mellatWsdl, options, (err, client) => {
            client.bpSettleRequest(args, (err, result, body) => {

                if(err) {
                    //console.log(err);
                    reject(err);
                }
                return resolve(result);
            })
        });
    });
}

module.exports = {
    payment,
    callBackMellat
}