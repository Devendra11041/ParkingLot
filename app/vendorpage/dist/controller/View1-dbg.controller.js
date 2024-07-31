sap.ui.define([
    "./Basecontroller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
],
    function (Controller, Filter, FilterOperator) {
        "use strict";

        return Controller.extend("com.app.vendorpage.controller.View1", {
            onInit: function () {
                // Initialize models

                var today = new Date();

                // Calculate tomorrow based on today
                var tomorrow = new Date(today);
                tomorrow.setDate(today.getDate());

                // Set the minimum date for the date picker
                var oDateTimePicker = this.getView().byId("idinputdatepicker");
                oDateTimePicker.setMinDate(tomorrow);

                // Set display format to show only date
                oDateTimePicker.setDisplayFormat("yyyy-MM-dd");

                const oVehicleTypeModel = new sap.ui.model.json.JSONModel({
                    vehicleTypes: [
                        { key: "inward", text: "inward" },
                        { key: "outward", text: "outward" }
                    ]
                });
                this.getView().setModel(oVehicleTypeModel, "vehicleTypeModel");
            },
            // RESERVATION
            onReservePressbtn: async function () {
                debugger
                var oView = this.getView();

                var sVehicleNo = oView.byId("InputVehicleno").getValue();
                var sDriverName = oView.byId("InputDriverName").getValue();
                var sPhoneNo = oView.byId("InputPhonenumber").getValue();
                var sVehicleType = oView.byId("InputVehicletype").getSelectedKey();
                var sParkingLot = oView.byId("idcombox1").getValue();
                var oDateTimePicker = oView.byId("idinputdatepicker");
                var oSelectedDateTime = oDateTimePicker.getDateValue();

                var newmodel = new sap.ui.model.json.JSONModel({
                    vehicalNo: sVehicleNo,
                    driverName: sDriverName,
                    phone: sPhoneNo,
                    vehicalType: sVehicleType,
                    plotNo_plot_NO: sParkingLot,
                    Expectedtime: oSelectedDateTime,
                    notify: `Vendor ${sDriverName} requested the ${sParkingLot} lot for the following time ${oSelectedDateTime}:`
                });

                this.getView().setModel(newmodel, "newmodel");
                const oModel = this.getView().getModel("ModelV2");
                const oPayload = this.getView().getModel("newmodel").getProperty("/");

                // Check if Vehicle Number already exists
                const vehicleExists = await this.checkVehicleExists(oModel, sVehicleNo);
                if (vehicleExists) {
                    sap.m.MessageBox.error("Vehicle number already exists. Please enter a different vehicle number.");
                    return;
                }

                // Create the reservation entry
                try {
                    await this.createData(oModel, oPayload, "/Reservation");
                    sap.m.MessageBox.success("Parking lot reserved successfully");
                    // oModel.refresh(true);
                } catch (error) {
                    sap.m.MessageBox.error("Failed to create reservation. Please try again.");
                    console.error("Error creating reservation:", error);
                }
                this.onclearreservations();
            },

            checkVehicleExists: async function (oModel, sVehicleNo) {
                debugger
                return new Promise((resolve, reject) => {
                    oModel.read("/Reservation", {
                        filters: [
                            new Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, sVehicleNo)
                        ],
                        success: function (oData) {
                            resolve(oData.results.length > 0);
                        },
                        error: function () {
                            reject("An error occurred while checking vehicle number existence.");
                        }
                    });
                });
            },
            onclearreservations: function () {
                this.getView().byId("InputVehicleno").setValue("");
                this.getView().byId("InputDriverName").setValue("");
                this.getView().byId("InputPhonenumber").setValue("");
                this.getView().byId("InputVehicletype").setValue("");
                this.getView().byId("idcombox1").setValue("");
                this.getView().byId("idinputdatepicker").setValue("");
            },
        });
    });