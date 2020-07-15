const mysql = require('mysql');

const config = {
    user  : 'fcity',
    password : 'Za123456',
    database : 'fcity',
    host: '47.116.75.164', // 47.103.39.44 root
    connectionLimit: 50,
    supportBigNumbers: true
};

const pool = mysql.createPool(config);

let query = function( sql, values, callback ) {
    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, connection) {
            if(err) {
                reject(err);
            } else {
                connection.query(sql, values, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        if(callback && typeof callback === 'function') {
                            callback(err, rows);
                        }
                        resolve(rows);
                    }
                    connection.release();
                })
            }
        })
    })
};

module.exports = query;