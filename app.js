const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');

require('dotenv').config();
const bankRoutes = require('./apps/routes');

global.publicDir = __dirname + "/public/";

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public'));
app.set('view engine', 'ejs');


app.get('/',(req,res)=>{
    // res.end('server is ok')
    res.render('mellat_payment_result.ejs')
})



app.use('/pay', bankRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server runs on port ${PORT}`));