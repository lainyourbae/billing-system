const express = require("express");
const multer = require('multer');
const bcrypt = require("bcryptjs");
const uuid = require('uuid');
const xlsx = require('xlsx');
const dbPromise = require("../db");
const { api_key, verify_token, authorize } = require("../auth")
const app = express();

const upload = multer({ dest: 'uploads/' });

function excelSerialToJSDate(serial) {
  const excelStartDate = new Date(1899, 12, 1);
  return new Date(excelStartDate.getTime() + serial * 24 * 60 * 60 * 1000);
}

function formatDate(serial) {
  const date = excelSerialToJSDate(serial);
  return date.toISOString().split('T')[0]; // Hasil: "2023-04-21"
}

app.post('/api/upload', upload.single('file'), api_key, verify_token, authorize(['admin']), async (req, res) => {
    const file = req.file;
  
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    const workbook = xlsx.readFile(file.path);
    const sheet_name_list = workbook.SheetNames;
    const worksheet = workbook.Sheets[sheet_name_list[0]];
    let data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    data = data.slice(1);
  
    try{
      for (const row of data) {
        const [ status_1, 
          nomor_invoice, 
          nama, 
          brand, 
          service_temp, 
          term,
          period_start_temp,
          period_end_temp,
          status_2,
          inv_no,
          so_no,
          mo_bast,
          inv_date_temp,
          inv_amount_dpp,
          ppn_11,
          total_inv,
          pph_2,
          receive,
          paid_unpaid,
          total_payment_temp,
          payment_date_temp
         ] = row;
        
        if (!nomor_invoice) {
          return res.status(201).json({ message: "Data Berhasil ditambahkan." });
        }

        let service;
        
        if (service_temp.startsWith(brand)) {
          service = service_temp.substring(brand.length).trim();
        } else {
          service = service_temp
        }
        
        let period_start;
        let period_end;
        let inv_date;
        let payment_date;

        if ( period_start_temp != '' ) {
          period_start = formatDate(period_start_temp);
        }
        
        if ( period_end_temp != '' ) {
          period_end = formatDate(period_end_temp);
        }

        if ( inv_date_temp != null ) {
          inv_date = formatDate(inv_date_temp);
        }

        if ( payment_date_temp != null ) {
          payment_date = formatDate(payment_date_temp);
        }

        // cek company
        const query_1 = "SELECT id, nama, brand FROM company WHERE nama = ? AND brand = ?";
        const [result_1] = await dbPromise.query(query_1, [nama, brand]);
        let id_company;
  
        if (result_1.length == 0) {
          const query_2 = "INSERT INTO company (nama, brand) VALUES (?, ?)";
          const [result_2] = await dbPromise.query(query_2, [nama, brand]);
          id_company = result_2.insertId;
  
        } else {
          id_company = result_1[0].id;
        }
  
        // cek invoice
        const query_3 = "SELECT id FROM invoices WHERE nomor_invoice = ?";
        const [result_3] = await dbPromise.query(query_3, nomor_invoice);
        let id_invoices;
  
        let hitung = 0;
        let total_kurang = 0
        let total_lebih = 0;

        let total_payment;
  
        if(total_payment_temp != null){
          total_payment = total_payment_temp;
        } else {
          total_payment = 0;
        }

        hitung = receive - total_payment;
        if(receive !== hitung){
          if(hitung <= 0){
            total_kurang = 0;
            total_lebih = hitung * -1;
          } else {
            total_lebih = 0;
            total_kurang = hitung;
          }
        }

        // invoice belum ada
        if (result_3.length == 0) {
          // cek service
          const query_6 = "SELECT id FROM services WHERE nama = ?";
          const [result_6] = await dbPromise.query(query_6, [service]);
          let id_services;

          // service belum ada
          if(result_6.length == 0) {
            const query_7 = "INSERT INTO services (nama) VALUES (?)";
            const [result_7] = await dbPromise.query(query_7, [service]);
            id_services = result_7.insertId;
  
            const query_8 = "INSERT INTO services_company (id_company, id_services) VALUES (?, ?)";
            const [result_8] = await dbPromise.query(query_8, [id_company, id_services]);
            const id_services_company = result_8.insertId;
  
            const query_4 = "INSERT INTO services_period (id_services_company, period_start, period_end, term) VALUES (?, ?, ?, ?)";
            const [result_4] = await dbPromise.query(query_4, [id_services_company, period_start, period_end, term]);
            const id_services_period = result_4.insertId;

            const query_5 = `INSERT INTO invoices (nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih_bayar, total_kurang_bayar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const [result_5] = await dbPromise.query(query_5, [nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih, total_kurang]);    
            id_invoices = result_5.insertId;
          
            const query_6 = "INSERT INTO invoices_services (id_services_period, id_invoices) VALUES (?, ?)";
            await dbPromise.query(query_6, [id_services_period, id_invoices]);
  
          } else {
            id_services = result_6[0].id;
  
            // cek service company
            const query_7 = "SELECT id FROM services_company WHERE id_company = ? AND id_services = ?";
            const [result_7] = await dbPromise.query(query_7, [id_company, id_services]);
            let id_services_company;
  
              // service company belum ada
              if(result_7.length == 0) {
                const query_8 = "INSERT INTO services_company (id_company, id_services) VALUES (?, ?)";
                const [result_8] = await dbPromise.query(query_8, [id_company, id_services]);
                id_services_company = result_8.insertId;
      
                const query_4 = "INSERT INTO services_period (id_services_company, period_start, period_end, term) VALUES (?, ?, ?, ?)";
                const [result_4] = await dbPromise.query(query_4, [id_services_company, period_start, period_end, term]);
                const id_services_period = result_4.insertId;
      
                const query_5 = `INSERT INTO invoices (nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih_bayar, total_kurang_bayar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const [result_5] = await dbPromise.query(query_5, [nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih, total_kurang]);
                id_invoices = result_5.insertId;
              
                const query_6 = "INSERT INTO invoices_services (id_services_period, id_invoices) VALUES (?, ?)";
                await dbPromise.query(query_6, [id_services_period, id_invoices]);
              } else {
                id_services_company = result_7[0].id;

                const query_4 = "INSERT INTO services_period (id_services_company, period_start, period_end, term) VALUES (?, ?, ?, ?)";
                const [result_4] = await dbPromise.query(query_4, [id_services_company, period_start, period_end, term]);
                id_services_period = result_4.insertId;
      
                const query_5 = `INSERT INTO invoices (nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih_bayar, total_kurang_bayar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const [result_5] = await dbPromise.query(query_5, [nomor_invoice, status_1, status_2, inv_no, so_no, mo_bast, inv_date, inv_amount_dpp, ppn_11, total_inv, pph_2, receive, paid_unpaid, total_payment, payment_date, total_lebih, total_kurang]);    
                id_invoices = result_5.insertId;
              
                const query_6 = "INSERT INTO invoices_services (id_services_period, id_invoices) VALUES (?, ?)";
                await dbPromise.query(query_6, [id_services_period, id_invoices]);
              }
          }
        } else {
          id_invoices = result_3[0].id;
  
          const query_4 = "SELECT * FROM invoices WHERE id = ?";
          const [result_4] = await dbPromise.query(query_4, [id_invoices]);
  
          if( inv_amount_dpp != result_4[0].inv_amount_dpp ){
            const query_5 = "UPDATE invoices SET inv_amount_dpp = ? WHERE id = ?";
            await dbPromise.query(query_5, [ inv_amount_dpp, id_invoices]);
  
          }
          if( ppn_11 != result_4[0].ppn_11 ){
            const query_5 = "UPDATE invoices SET ppn_11 = ? WHERE id = ?";
            await dbPromise.query(query_5, [ ppn_11, id_invoices]);
  
          }
          if( total_inv != result_4[0].total_inv ){
            const query_5 = "UPDATE invoices SET total_inv = ? WHERE id = ?";
            await dbPromise.query(query_5, [ total_inv, id_invoices]);
          }
          if( pph_2 != result_4[0].pph_2){
            const query_5 = "UPDATE invoices SET pph_2 = ? WHERE id = ?";
            await dbPromise.query(query_5, [ pph_2, id_invoices]);
  
          }
          if( receive != result_4[0].receive){
            const query_5 = "UPDATE invoices SET receive = ? WHERE id = ?";
            await dbPromise.query(query_5, [ receive, id_invoices]);

          }
          if( paid_unpaid != result_4[0].paid_unpaid){
            const query_5 = "UPDATE invoices SET paid_unpaid = ? WHERE id = ?";
            await dbPromise.query(query_5, [ paid_unpaid, id_invoices]);
  
          }
          if( total_payment != result_4[0].total_payment){
            const query_5 = "UPDATE invoices SET total_payment = ? WHERE id = ?";
            await dbPromise.query(query_5, [ total_payment, id_invoices]);
          }
          if( payment_date != result_4[0].payment_date){
            const query_5 = "UPDATE invoices SET payment_date = ? WHERE id = ?";
            await dbPromise.query(query_5, [ payment_date, id_invoices]);
          }
        } 
      };
    
      res.send('File uploaded and data updated successfully.');
    } catch (err){
      console.error("Error:", err);
      return res.status(401).json({ message: "Invalid Server Error." });
    }
});

app.post('/api/upload/am', upload.single('file'), api_key, verify_token, authorize(['admin']), async (req, res) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const workbook = xlsx.readFile(file.path);
  const sheet_name_list = workbook.SheetNames;
  const worksheet = workbook.Sheets[sheet_name_list[0]];
  let data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  data = data.slice(1);
  try {
    for (const row of data) {
      const [nama, company_name, brand] = row;
      if (!nama) {
        return res.status(201).json({ message: "Data Berhasil ditambahkan." });
      }
      const query_1 = "SELECT id, nama, brand FROM company WHERE nama = ? AND brand = ?";
      const [result_1] = await dbPromise.query(query_1, [company_name, brand]);

      if (result_1.length == 0) {
        const query_2 = "INSERT INTO company (nama, brand) VALUES (?, ?)";
        const [result_2] = await dbPromise.query(query_2, [company_name, brand]);
        id_company = result_2.insertId;
      } else {
        id_company = result_1[0].id;
      }

      const query_7 = "SELECT id, nama FROM am WHERE nama = ?";
      const [result_7] = await dbPromise.query(query_7, nama);
      let am_id;

      const query_id = "SELECT id FROM am ORDER BY id DESC LIMIT 1";
      const [result_id] = await dbPromise.query(query_id);
      let id; 

      if(result_id.length == 0){
        id = 1;
      } else {
        id = result_id[0].id + 1;
      }


      if (result_7.length == 0) {
        const user_id = uuid.v4();
        const email = `am${id}@gmail.com`;
        const password = bcrypt.hashSync(email, 12);
        const id_role = 4;
        
        const query_3 = "INSERT INTO users (id, nama, email, password, id_role) VALUES (?, ?, ?, ?, ?)";
        await dbPromise.query(query_3, [user_id, nama, email, password, id_role]);
        
        const query_4 = "INSERT INTO am (user_id, nama) VALUES (?, ?)";
        const [result_4] = await dbPromise.query(query_4, [user_id, nama]);        
        am_id = result_4.insertId;
      } else {
        am_id = result_7[0].id;
      }

      const query_5 = "SELECT id FROM am_company WHERE am_id = ? AND company_id = ?";
      const [result_5] = await dbPromise.query(query_5, [am_id, id_company]);

      if(result_5.length == 0){
        const query_6 = "INSERT INTO am_company (am_id, company_id) VALUES (?, ?)";
        await dbPromise.query(query_6, [am_id, id_company]);
      }
    }
    return res.status(201).json({ message: "Data successfully added." });
  } catch (err) {
    console.error("Error:", err);
    return res.status(401).json({ message: "Invalid Server Error." });
  }
})

  module.exports = app;