import database from "../config/db.config.js";

//ter
export async function chkCart(req, res) {
  if (req.body.memEmail == null) {
    return res.json({ error: true, errormessage: "member Email is required" });
  }
  const result = await database.query({
    text: `SELECT * FROM carts WHERE "cusId" = $1 AND "cartCf" != true`,
    values: [req.body.memEmail],
  });
  if (result.rows[0] != null) {
    return res.json({ cartExist: true, cartId: result.rows[0].cartId });
  } else {
    return res.json({ cartExist: false });
  }
}

//max

//art
