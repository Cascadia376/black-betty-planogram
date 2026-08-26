# Campaign Product Import v1

Upload `.xlsx` workbooks from a campaign's Products workspace only. The first worksheet must use this exact header order:

`SKU | Role | Required | Notes`

`Role` accepts `Feature`, `Core`, `Supporting`, or `Optional`. `Required` accepts `Yes`/`No`, `True`/`False`, `Required`/`Optional`, or blank for required. Product name, category, and case pack are resolved from Product Master and are intentionally not imported as campaign fields.

The workbook is validated and reviewed before any campaign membership is written. Valid unknown SKUs can be resolved through controlled pending Product Master creation; invalid rows must be corrected in-app or omitted. This format is separate from the OND allocation importer.
