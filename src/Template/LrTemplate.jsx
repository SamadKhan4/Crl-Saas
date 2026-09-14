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
  <div className="w-4 h-4 border border-black text-[7px] shrink-0" style={{ lineHeight: '8px', textAlign: 'center' }}>
    {children}
  </div>
);

const BoxRow = ({ count = 10, value = "" }) => (
  <div className="flex gap-[2px]">
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
        className="w-4 h-4 border border-black text-[7px] shrink-0"
        style={{ lineHeight: '9px', textAlign: 'center' }}
      >
        {ch}
      </div>
    ))}
  </div>
);

const Label = ({ children, className = "" }) => (
  <span className={`text-[9px] font-semibold ${className}`}>{children}</span>
);

const SectionHeader = ({ children, className = "" }) => (
  <div
    className={`border border-black bg-white text-center text-[10px] font-bold py-[2px] tracking-wide ${className}`}
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
const date = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
  : "";

const LrTemplate = forwardRef(function LrTemplate({ shipment = {} }, ref) {
  const s = { ...shipment, ...shipment.lrDetails };
  const customer = typeof s.customerId === "object" ? s.customerId : s.customer || {};
  const charges = [s.freightCharges, s.fuelCharges, s.handlingCharges, s.fodCodCharges, s.rovCharges, s.docketCharges];
  return (
    <div ref={ref} className="lr-print-root" style={{ width: 1000, background: "white", color: "black" }}>
      <div className="flex" style={{ width: 1000 }}>
        {/* Main document */}
        <div className="flex-1 border border-black text-black bg-white font-sans">
          {/* Header row: logo/company + consignment note/barcode */}
          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-8 border-r border-black p-2 flex gap-2 items-start">
              <div className="shrink-0 pt-1">
                <div className="text-2xl font-black italic leading-none">
                  <span className="text-black">C</span>
                  <span style={{ color: '#c9232a' }}>R</span>
                  <span className="text-black">L</span>
                </div>
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">
                  CHAPLE ROADLINES PVT. LTD.
                </div>
                <div className="text-[9px] leading-tight mt-[2px]">
                  Shop No. 3, Opp. Joshi Clinic Beside Pushpa Mobile,
                  <br />
                  Wadi, Nagpur – 440023 (MH.)&nbsp;&nbsp;
                  <span className="font-semibold">Mobile :</span> 7499358403
                </div>
                <div className="text-[9px] leading-tight mt-[2px] flex gap-4">
                  <span>
                    <span className="font-semibold">Email</span> :
                    info@crl-transport.com
                  </span>
                  <span>
                    <span className="font-semibold">Website</span> :
                    www.crl-transport.com
                  </span>
                </div>
                <div className="text-[9px] leading-tight mt-[2px]">
                  <span className="font-semibold">GST No.:</span>{" "}
                  27AANCC4313N1ZC&nbsp;&nbsp;
                  <span className="font-semibold">PAN :</span> AANCC4313N
                </div>
                <div className="text-[9px] leading-tight">
                  <span className="font-semibold">Transporter ID :</span>{" "}
                  27AANCC4313N1ZC
                </div>
              </div>
            </div>
            <div className="col-span-4 flex flex-col">
              <div className="text-center text-[11px] font-bold border-b border-black py-[3px]">
                CONSIGNMENT NOTE
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-1">
                <div className="text-[18px] font-bold tracking-wide mt-2">{display(s.lrNumber) || "LR PENDING"}</div>
              </div>
            </div>
          </div>

          {/* Consignor / Consignee / Booking block */}
          <div className="grid grid-cols-12 border-b border-black">
            {/* Left: Consignor + Consignee (8 cols) */}
            <div className="col-span-8 border-r border-black">
              <div className="grid grid-cols-2">
                <SectionHeader className="border-t-0 border-l-0">
                  CONSIGNOR DETAILS
                </SectionHeader>
                <SectionHeader className="border-t-0 border-l-0 border-r-0">
                  CONSIGNEE DETAILS
                </SectionHeader>
              </div>

              {/* Row: Code / Name */}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Consignor Code</Label>
                  <BoxRow count={9} value={s.consignorCode || customer.customerCode} />
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>Consignee Name</Label>
                  <span className="text-[9px]">{display(s.consigneeName || s.receiverName)}</span>
                </div>
              </div>

              {/* Row: Name / Address */}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Consignor Name</Label>
                  <span className="text-[9px]">{display(s.consignorName || s.senderName || customer.name)}</span>
                </div>
                <div className="p-1 flex items-center gap-1">
                  <Label>Address</Label>
                  <span className="text-[9px]">{display(s.consigneeAddress)}</span>
                </div>
              </div>

              {/* Row: Address / Address cont. */}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Address</Label>
                  <span className="text-[9px]">{display(s.consignorAddress || customer.address)}</span>
                </div>
                <div className="p-1">
                  <Dots />
                </div>
              </div>

              {/* Row: Address cont. / Address cont. */}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black">
                  <Dots />
                </div>
                <div className="p-1">
                  <Dots />
                </div>
              </div>

              {/* Row: PIN CODE / PIN CODE */}
              <div className="grid grid-cols-2 border-t border-black">
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
              <div className="grid grid-cols-2 border-t border-black">
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
                <div className="p-1 border-r border-black">
                  <Label>Booking Date</Label> <span className="text-[9px]">{date(s.bookingDate || s.createdAt)}</span>
                </div>
                <div />
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
              <div className="grid grid-cols-2 border-t border-black">
                <div className="p-1 border-r border-black flex items-center gap-1">
                  <Label>Invoice No.</Label> <span className="text-[9px]">{display(s.invoiceNo)}</span>
                </div>
                <div className="p-1 flex items-center gap-2">
                  <Label>Date</Label>
                  <DateBoxes value={date(s.invoiceDate)} />
                </div>
              </div>
              <div className="grid grid-cols-2 border-t border-black">
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
          <table className="w-full border-collapse border-b border-black text-[9px]">
            <thead>
              <tr>
                {[
                  "Pkg.No.",
                  "Description of Goods",
                  "Pkg. Type",
                  "Actual Wt. (Kg.)",
                  "Charged Wt. (Kg.)",
                  "Dimensions ( L x B x H) cm",
                  "Volume",
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
              <tr>{[s.packageNumber || s.packageCount, s.goodsDescription || s.description, s.packageType, s.actualWeight || s.weightKg, s.chargedWeight, s.dimensions, s.volume, s.declaredValue].map((item, index) => <td key={index} className="border border-black h-6 px-1 text-center">{display(item)}</td>)}</tr>
              <tr>{Array.from({ length: 8 }).map((_, index) => <td key={index} className="border border-black h-6" />)}</tr>
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
                  <div className="w-14 h-3 border border-black text-center leading-3">{s.paymentMode === m.replace(" ", "_") ? "X" : ""}</div>
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
                  <div className="w-14 h-3 border border-black text-center leading-3">{s.riskType === m.replace(" ", "_") ? "X" : ""}</div>
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
                  <div className="w-14 h-3 border border-black text-center leading-3">{s.insuranceType === m.replace(" ", "_") ? "X" : ""}</div>
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
                "FOD / COD CHARGES",
                "ROV CHARGES",
                "DOCKET CHARGES",
              ].map((c, index) => (
                <div key={c} className="grid grid-cols-2 border-t border-black">
                  <div className="px-1 py-[3px] border-r border-black font-semibold">
                    {c}
                  </div>
                  <div className="px-1 py-[3px]">{display(charges[index])}</div>
                </div>
              ))}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="px-1 py-[3px] border-r border-black font-semibold">
                  GST @ {display(s.gstRate)}%
                </div>
                <div className="px-1 py-[3px]">{display(s.gstAmount)}</div>
              </div>
              <div className="grid grid-cols-2 border-t border-black flex-1">
                <div className="px-1 py-[3px] bg-black text-white font-bold border-r border-black flex items-center">
                  TOTAL
                </div>
                <div className="px-1 py-[3px] font-bold">{display(s.totalAmount)}</div>
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
            <div className="col-span-3 p-1 text-[9px] font-semibold">
              For CHAPLE ROADLINES PVT. LTD.
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
