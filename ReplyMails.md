curl.exe -X POST "http://localhost:43127/target/create-client" `
  -H "Content-Type: application/json" `
  -d '{"email":"client@example.com","information":{"business_name":"Example Company","seller_name":"Example","store_link":"https://example.com"}}'