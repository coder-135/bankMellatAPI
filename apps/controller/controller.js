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
                // let bankRespond = {
                //     url:PgwSite,
                //     RefId:payRequestResult[1]};
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
                    let msg = 'تراکنش شما با موفقیت انجام شد ';
                    msg += " لطفا شماره پیگیری را یادداشت نمایید" + saleReferenceId;

                    //save success payment into db
                    console.log(msg);

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