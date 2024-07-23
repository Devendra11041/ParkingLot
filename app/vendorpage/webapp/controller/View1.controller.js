sap.ui.define([
    "./Basecontroller",
],
    function (Controller) {
        "use strict";

        return Controller.extend("com.app.vendorpage.controller.View1", {
            onInit: function () {

            },
            onReservePressbtn: async function () {
                debugger
                var oView = this.getView();

                var sVehicleNo = oView.byId("InputVehicleno").getValue();
                var sDriverName = oView.byId("InputDriverName").getValue();
                var sPhoneNo = oView.byId("InputPhonenumber").getValue();
                var sVehicleType = oView.byId("InputVehicletype").getValue();
                var sParkingLot = oView.byId("idcombox1").getValue();
                var oDateTimePicker = oView.byId("idinputdatepicker");
                var oSelectedDateTime = oDateTimePicker.getDateValue();

                var newmodel = new sap.ui.model.json.JSONModel({
                    vehicalNo: sVehicleNo,
                    driverName: sDriverName,
                    phone: sPhoneNo,
                    vehicalType: sVehicleType,
                    plotNo_plot_NO: sParkingLot,
                    Expectedtime: oSelectedDateTime
                });

                this.getView().setModel(newmodel, "newmodel");
                const oModel = this.getView().getModel("ModelV2");
                const oPayload = this.getView().getModel("newmodel").getProperty("/");

                // Create the reservation entry
                try {
                    await this.createData(oModel, oPayload, "/Reservation");
                    sap.m.MessageBox.success("Parking lot reserved  successfully");
                } catch (error) {
                    sap.m.MessageBox.error("Failed to create reservation. Please try again.");
                    console.error("Error creating reservation:", error);
                }
            }

        });
    });
