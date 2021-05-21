const express = require("express");
const app = express();
const cors = require("cors");
require('dotenv').config();
const bankRoutes = require('./apps/routes');


app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


app.get('/',(req,res)=>{
    res.end('Done');
})



app.use('/pay', bankRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server runs on port ${PORT}`));