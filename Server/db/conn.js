const mongoose = require("mongoose");

const DB = process.env.DATABASE;
// const DB = "mongodb+srv://beyondscool:rkJbr4Nnr8Nq9oXt@cluster0.m8j5b8c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

mongoose.connect(DB,{
    useUnifiedTopology:true,
    // useNewUrlParsar:true
}).then(() =>console.log("database created")).catch((err)=>console.log("error",err))
