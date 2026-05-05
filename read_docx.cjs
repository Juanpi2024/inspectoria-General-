const mammoth = require("mammoth");

mammoth.extractRawText({path: "./NOMINAS/1ero y 2do Medio HC.docx"})
    .then(function(result){
        const text = result.value; // The raw text
        console.log(text.substring(0, 1000));
    })
    .catch(function(error) {
        console.error(error);
    });
