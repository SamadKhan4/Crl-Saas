import React, { forwardRef } from "react";

/**
 * Chaple Roadlines Pvt. Ltd. — Consignment Note (9x6 Book)
 * Pixel-close React + Tailwind replica of the printed waybill.
 *
 * Usage: <ChapleRoadlinesForm /> — designed for a fixed 1000px canvas,
 * scales down responsively via the outer wrapper.
 */

// Small reusable bits -------------------------------------------------

const Box = ({ children }) => (
  <div className="w-4 h-4 border border-black text-[9px] font-semibold shrink-0 flex items-center justify-center">
    <span className="lr-box-value">{children}</span>
  </div>
);

const BoxRow = ({ count = 10, value = "" }) => (
  <div className="lr-box-row flex gap-[2px]">
    {Array.from({ length: count }).map((_, i) => (
      <Box key={i}>{String(value)[i] || ""}</Box>
    ))}
  </div>
);

const DateBoxes = ({ value }) => (
  <div className="flex gap-[2px] items-center">
    {String(value || "").replace(/\D/g, "").padEnd(8, " ").slice(0, 8).split("").map((ch, i) => (
      <div
        key={i}
        className="w-4 h-4 border border-black text-[9px] font-semibold shrink-0 flex items-center justify-center"
      >
        <span className="lr-box-value">{ch}</span>
      </div>
    ))}
  </div>
);

const Label = ({ children, className = "" }) => (
  <span className={`text-[11px] font-semibold ${className}`}>{children}</span>
);

const SectionHeader = ({ children, className = "" }) => (
  <div
    className={`border border-black bg-white text-center text-[12px] font-bold py-[2px] tracking-wide ${className}`}
  >
    {children}
  </div>
);

const Dots = ({ w = "w-full" }) => (
  <div className={`border-b border-dotted border-black ${w} h-[10px]`} />
);

// Main component --------------------------------------------------------

const display = (value) => value === 0 || value ? String(value) : "";
const branch = (value) => value?.name || value?.city || display(value);
const amountInWords = (value) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const words = (n) => n < 20 ? ones[n] : n < 100 ? `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim() : n < 1000 ? `${ones[Math.floor(n / 100)]} Hundred ${words(n % 100)}`.trim() : n < 100000 ? `${words(Math.floor(n / 1000))} Thousand ${words(n % 1000)}`.trim() : n < 10000000 ? `${words(Math.floor(n / 100000))} Lakh ${words(n % 100000)}`.trim() : `${words(Math.floor(n / 10000000))} Crore ${words(n % 10000000)}`.trim();
  const amount = Math.max(0, Number(value) || 0);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return `Rupees ${words(rupees) || "Zero"}${paise ? ` and ${words(paise)} Paise` : ""} Only`;
};
const date = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
  : "";

const LrTemplate = forwardRef(function LrTemplate({ shipment = {} }, ref) {
  const s = { ...shipment, ...shipment.lrDetails };
  const customer = typeof s.customerId === "object" ? s.customerId : s.customer || {};
  const charges = [s.freightCharges, s.fuelCharges, s.handlingCharges, s.fodCharges, s.codCharges, s.rovCharges, s.docketCharges];
  const goods = s.goods?.length ? s.goods : [{ packageNumber: s.packageNumber || s.packageCount, description: s.goodsDescription || s.description, packageType: s.packageType, actualWeight: s.actualWeight ?? s.weightKg, chargedWeight: s.chargedWeight, dimensions: s.dimensions, volume: s.volume, declaredValue: s.declaredValue }];
  const declaredValue = s.declaredValue ?? goods.reduce((total, row) => total + Number(row.declaredValue || 0), 0);
  return (
    <div ref={ref} className="lr-print-root" style={{ width: 1000, background: "white", color: "black" }}>
      <style>{`.lr-print-root,.lr-print-root *{box-sizing:border-box}.lr-print-root{font-size:11px}.lr-print-root [class~="text-[9px]"]{font-size:11px!important}.lr-print-root [class~="text-[8px]"]{font-size:10px!important}.lr-print-root [class~="text-[7px]"]{font-size:9px!important}.lr-print-root .lr-party-fields{display:flex;flex-direction:column}.lr-print-root .lr-party-fields .lr-form-row{flex:1}.lr-print-root .lr-form-row>div{min-width:0;min-height:31px;padding:6px 7px}.lr-print-root .lr-form-row .lr-value{min-width:0;flex:1;text-align:center;overflow-wrap:anywhere;line-height:1.3}.lr-print-root .lr-box-row{flex-shrink:0}.lr-print-root .lr-goods-table th,.lr-print-root .lr-goods-table td{vertical-align:middle;text-align:center;line-height:1.3}.lr-print-root .lr-goods-table td{overflow-wrap:anywhere}.lr-print-root .lr-amount-value{display:flex;align-items:center;justify-content:center;text-align:center}.lr-print-root .lr-value,.lr-print-root .lr-box-value,.lr-print-root .lr-amount-value{position:relative;top:-6px}.lr-print-root .lr-check-box{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}`}</style>
      <div className="flex" style={{ width: 1000 }}>
        {/* Main document */}
        <div className="flex-1 border border-black text-black bg-white font-sans">
          {/* Header row: logo/company + consignment note/barcode */}
          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-8 border-r border-black p-2 flex items-center" style={{ gap: 24, minHeight: 100 }}>
              <img src="/crl-logo.png" alt="Chaple Roadlines logo" width="120" height="54" style={{ width: 120, height: 54, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div className="text-xl font-extrabold tracking-tight">
                  CHAPLE ROADLINES PVT. LTD.
                </div>
                <div className="text-[11px] leading-tight mt-[2px]">
                  Shop No. 3, Opp. Joshi Clinic Beside Pushpa Mobile,
                  <br />
                  Wadi, Nagpur – 440023 (MH.)&nbsp;&nbsp;
                  <span className="font-semibold">Mobile :</span> 7499358403
                </div>
                <div className="text-[11px] leading-tight mt-[2px] flex gap-4">
                  <span>
                    <span className="font-semibold">Email</span> :
                    info@crl-transport.com
                  </span>
                  <span>
                    <span className="font-semibold">Website</span> :
                    www.crl-transport.com
                  </span>
                </div>
                <div className="text-[11px] leading-tight mt-[2px]">
                  <span className="font-semibold">GST No.:</span>{" "}
                  27AANCC4313N1ZC&nbsp;&nbsp;
                  <span className="font-semibold">PAN :</span> AANCC4313N
                </div>
                <div className="text-[11px] leading-tight">
                  <span className="font-semibold">Transporter ID :</span>{" "}
                  27AANCC4313N1ZC
                </div>
              </div>
            </div>
            <div className="col-span-4 flex flex-col">
              <div className="text-center text-[13px] font-bold border-b border-black py-[3px]">
                CONSIGNMENT NOTE
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-1">
                <div className="text-[22px] font-bold tracking-wide mt-2">{display(s.lrNumber) || "LR PENDING"}</div>
              </div>
            </div>
          </div>

          {/* Consignor / Consignee / Booking block */}
          <div className="grid grid-cols-12 border-b border-black">
            {/* Left: Consignor + Consignee (8 cols) */}
            <div className="lr-party-fields col-span-8 border-r border-black">
              <div className="grid grid-cols-2">
                <SectionHeader className="border-t-0 border-l-0">
                  CONSIGNOR DETAILS
                </SectionHeader>
                <SectionHeader className="border-t-0 border-l-0 border-r-0">
                  CONSIGNEE DETAILS
                </SectionHeader>
              </div>

              {/* Row: Code / Name */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Consignor Code</Label>
                  <BoxRow count={9} value={s.consignorCode || customer.customerCode} />
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>Consignee Name</Label>
                  <span className="lr-value text-[9px]">{display(s.consigneeName || s.receiverName)}</span>
                </div>
              </div>

              {/* Row: Name / Address */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Consignor Name</Label>
                  <span className="lr-value text-[9px]">{display(s.consignorName || s.senderName || customer.name)}</span>
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>Address</Label>
                  <span className="lr-value text-[9px]">{display(s.consigneeAddress)}</span>
                </div>
              </div>

              {/* Row: Address / Address cont. */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Address</Label>
                  <span className="lr-value text-[9px]">{display(s.consignorAddress || customer.address)}</span>
                </div>
                <div className="p-1">
                  <Dots />
                </div>
              </div>

              {/* Row: Address cont. / Address cont. */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black">
                  <Dots />
                </div>
                <div className="p-1">
                  <Dots />
                </div>
              </div>

              {/* Row: PIN CODE / PIN CODE */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>PIN CODE</Label>
                  <BoxRow count={6} value={s.consignorPincode || customer.pincode} />
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>PIN CODE</Label>
                  <BoxRow count={6} value={s.consigneePincode} />
                </div>
              </div>

              {/* Row: GSTIN / GSTIN */}
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>GSTIN</Label>
                  <BoxRow count={15} value={s.consignorGstin || customer.gstNumber} />
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>GSTIN</Label>
                  <BoxRow count={15} value={s.consigneeGstin} />
                </div>
              </div>
            </div>

            {/* Right: Booking info + Delivery address + Contact (4 cols) */}
            <div className="col-span-4 flex flex-col">
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-1 col-span-2">
                  <Label>Booking Date</Label> <span className="text-[9px]">{date(s.bookingDate || s.createdAt)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-1 border-r border-black col-span-2">
                  <Label>Booking Branch</Label> <span className="text-[9px]">{display(s.bookingBranch || branch(s.originBranchId))}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-1 border-r border-black text-center">
                  <Label>From</Label><div className="text-[9px]">{display(s.from || branch(s.originBranchId))}</div>
                </div>
                <div className="p-1 text-center">
                  <Label>To</Label><div className="text-[9px]">{display(s.to || branch(s.destinationBranchId))}</div>
                </div>
              </div>
              <SectionHeader className="border-t-0 border-l-0 border-r-0 border-b-0">
                DELIVERY ADDRESS (If Different)
              </SectionHeader>
              <div className="flex-1 p-1 border-b border-black min-h-[54px] text-[9px]">{display(s.deliveryAddress)}</div>
              <div className="p-1">
                <Label>Contact No.</Label> <span className="text-[9px]">{display(s.contactNo || s.receiverMobile)}</span>
              </div>
            </div>
          </div>

          {/* Reference & document details / Other reference */}
          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-8 border-r border-black">
              <SectionHeader className="border-t-0 border-l-0 border-r-0">
                REFERENCE &amp; DOCUMENT DETAILS
              </SectionHeader>
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Invoice No.</Label> <span className="text-[9px]">{display(s.invoiceNo)}</span>
                </div>
                <div className="p-1 flex items-center gap-2">
                  <Label>Date</Label>
                  <DateBoxes value={date(s.invoiceDate)} />
                </div>
              </div>
              <div className="lr-form-row grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>E-Way Bill No.</Label> <span className="text-[9px]">{display(s.eWayBillNo)}</span>
                </div>
                <div className="p-1 flex items-center gap-2">
                  <Label>E-Way Bill Date</Label>
                  <DateBoxes value={date(s.eWayBillDate)} />
                </div>
              </div>
            </div>
            <div className="col-span-4 flex flex-col">
              <SectionHeader className="border-t-0 border-l-0 border-r-0">
                OTHER REFERENCE
              </SectionHeader>
              <div className="p-1 border-t border-black flex-1">
                <Label>PO / STN. No.</Label> <span className="text-[9px]">{display(s.poStnNo)}</span>
              </div>
              <div className="p-1 border-t border-black flex-1">
                <Label>Customer Reference</Label> <span className="text-[9px]">{display(s.customerReference)}</span>
              </div>
            </div>
          </div>

          {/* Goods table */}
          <table className="lr-goods-table w-full border-collapse border-b border-black text-[9px]" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {[
                  "Pkg.No.",
                  "Description of Goods",
                  "Pkg. Type",
                  "Actual Wt. (Kg.)",
                  "Charged Wt. (Kg.)",
                  "Dimensions (L x B x H) / Qty",
                  "Volume (CFT)",
                  "Declared Value (₹)",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="border border-black font-semibold py-[3px] px-1"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {goods.map((row, rowIndex) => <tr key={rowIndex}>{[row.packageNumber || rowIndex + 1, row.description, row.packageType, row.actualWeight, row.chargedWeight, row.length ? `${row.length} x ${row.breadth} x ${row.height} ${row.dimensionUnit?.toLowerCase()} / ${row.quantity}` : row.dimensions || (row.quantity ? `Qty: ${row.quantity}` : ''), row.volume, rowIndex === 0 ? declaredValue : ''].map((item, index) => <td key={index} className="border border-black h-6 px-1 text-center">{display(item)}</td>)}</tr>)}
              {s.goods?.length > 0 && <tr><td colSpan={8} className="border border-black px-1 py-[3px] font-semibold">Total actual: {display(s.actualWeight)} kg | Volumetric: {display(s.volumetricWeight)} kg | Chargeable weight for invoice: {display(s.chargedWeight)} kg</td></tr>}
            </tbody>
          </table>

          {/* Signatures + payment block */}
          <div className="grid grid-cols-12 border-b border-black">
            {/* Shipper signature */}
            <div className="col-span-3 border-r border-black flex flex-col">
              <div className="p-1 text-[9px] font-semibold">
                SHIPPER SIGNATURE
              </div>
              <div className="flex-1" />
              <div className="p-1 text-[8px] border-t border-black">
                <span className="font-semibold">Remarks :</span> {display(s.remarks)}
              </div>
              <div className="h-6" />
            </div>

            {/* Receiver signature */}
            <div className="col-span-3 border-r border-black flex flex-col text-[9px]">
              <div className="p-1 font-semibold">
                Receiver&rsquo;s Signature &amp; Stamp
              </div>
              <div className="px-1">Receiver&rsquo;s Name : {display(s.receiverNamePrint || s.receiverName)}</div>
              <div className="px-1 mt-1">Mobile No. : {display(s.receiverMobilePrint || s.receiverMobile)}</div>
              <div className="px-1 mt-1">Date &amp; Time : {date(s.receiverDateTime)}</div>
              <div className="px-1 mt-1 flex-1">Signature</div>
            </div>

            {/* Mode of payment / risk / insurance */}
            <div className="col-span-3 border-r border-black flex flex-col text-[9px]">
              <SectionHeader className="border-t-0 border-l-0 border-r-0">
                MODE OF PAYMENT
              </SectionHeader>
              {["PAID", "TO PAY", "CREDIT"].map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between px-1 py-[3px] border-t border-black"
                >
                  <span className="font-semibold">{m}</span>
                  <div className="lr-check-box w-14 h-4 border border-black">{s.paymentMode === m.replace(" ", "_") ? "X" : ""}</div>
                </div>
              ))}
              <SectionHeader className="border-l-0 border-r-0">
                RISK TYPE
              </SectionHeader>
              {["CARRIER RISK", "OWNER RISK"].map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between px-1 py-[3px] border-t border-black"
                >
                  <span className="font-semibold">{m}</span>
                  <div className="lr-check-box w-14 h-4 border border-black">{s.riskType === m.replace(" ", "_") ? "X" : ""}</div>
                </div>
              ))}
              <SectionHeader className="border-l-0 border-r-0 border-b-0">
                INSURANCE
              </SectionHeader>
              {["INSURED", "NOT INSURED"].map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between px-1 py-[3px] border-t border-black"
                >
                  <span className="font-semibold">{m}</span>
                  <div className="lr-check-box w-14 h-4 border border-black">{s.insuranceType === m.replace(" ", "_") ? "X" : ""}</div>
                </div>
              ))}
            </div>

            {/* Charges / Amount */}
            <div className="col-span-3 flex flex-col text-[9px]">
              <div className="grid grid-cols-2">
                <SectionHeader className="border-t-0 border-l-0 border-r-0">
                  CHARGES
                </SectionHeader>
                <SectionHeader className="border-t-0 border-r-0">
                  AMOUNT
                </SectionHeader>
              </div>
              {[
                "FREIGHT CHARGES",
                "FUEL CHARGES",
                "HANDLING CHARGES",
                "FOD CHARGES",
                "COD CHARGES",
                "ROV CHARGES",
                "DOCKET CHARGES",
              ].map((c, index) => (
                <div key={c} className="grid grid-cols-2 border-t border-black">
                  <div className="px-1 py-[3px] border-r border-black font-semibold">
                    {c}
                  </div>
                  <div className="lr-amount-value px-1 py-[3px]">{display(charges[index])}</div>
                </div>
              ))}
              {s.fodCodCharges != null && s.fodCharges == null && s.codCharges == null && <div className="grid grid-cols-2 border-t border-black"><div className="px-1 py-[3px] border-r border-black font-semibold">FOD / COD (LEGACY)</div><div className="px-1 py-[3px]">{display(s.fodCodCharges)}</div></div>}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="px-1 py-[3px] border-r border-black font-semibold">
                  GST @ {display(s.gstRate)}%
                </div>
                <div className="lr-amount-value px-1 py-[3px]">{display(s.gstAmount)}</div>
              </div>
              <div className="grid grid-cols-2 border-t border-black flex-1">
                <div className="px-1 py-[3px] bg-black text-white font-bold border-r border-black flex items-center">
                 SUB TOTAL
                </div>
                <div className="lr-amount-value px-1 py-[3px] font-bold">{display(s.totalAmount)}</div>
              </div>
            </div>
          </div>

          {/* Footer note + For Chaple */}
          <div className="grid grid-cols-12">
            <div className="col-span-9 border-r border-black p-1 text-[8px]">
              &middot;Goods are accepted subject to the
              <br />
              terms and conditions printed herein.
            </div>
            <div className="col-span-3 p-1 text-[9px] font-semibold text-center">
              {amountInWords(s.totalAmount)}
            </div>
          </div>

          {/* Bottom black perforation bar */}
          <div className="grid grid-cols-4 bg-black text-white text-[7px] font-semibold mt-1">
            <div className="px-1 py-[3px] border-r border-white">
              CHARGES (AS PER COURIER NORMS)
            </div>
            <div className="px-1 py-[3px] border-r border-white">
              Amount (₹)
            </div>
            <div className="px-1 py-[3px] border-r border-white">
              PAYMENT STATUS (Tick One)
            </div>
            <div className="px-1 py-[3px]">RISK &amp; INSURANCE DETAILS</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LrTemplate;
