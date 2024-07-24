sap.ui.define([
    "./Basecontroller",
    "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
],
    function (Controller,Filter,FilterOperator) {
        "use strict";

        return Controller.extend("com.app.vendorpage.controller.View1", {
            onInit: function () {
                // Initialize models
                debugger
                var oNotificationModel = new sap.ui.model.json.JSONModel({
                    Notifications: []
                });
                this.getView().setModel(oNotificationModel, "NotificationModel");
            },
            // RESERVATION
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

                    // Add notification on successful reservation
                    this.addNotification(sDriverName, sVehicleNo, sVehicleType, sParkingLot, oSelectedDateTime);
                } catch (error) {
                    sap.m.MessageBox.error("Failed to create reservation. Please try again.");
                    console.error("Error creating reservation:", error);
                }
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

            addNotification: function (sDriverName, sVehicleNo, sVehicleType, sParkingLot, oSelectedDateTime) {
                debugger
                var oNotificationModel = this.getView().getModel("NotificationModel");
                var aNotifications = oNotificationModel.getProperty("/Notifications");

                var oNewNotification = {
                    title: "Booking request",
                    description: `Driver Name: ${sDriverName}, Vehicle No: ${sVehicleNo}, Vehicle Type: ${sVehicleType}, Parking Lot: ${sParkingLot}, Expected Time: ${oSelectedDateTime}`,
                    datetime: new Date().toISOString(),
                    priority: "Low",
                    unread: true
                };

                // Check if a similar notification already exists
                var bExists = aNotifications.some(function (notification) {
                    return notification.description === oNewNotification.description && notification.datetime === oNewNotification.datetime;
                });

                // Add new notification if it doesn't exist
                if (!bExists) {
                    aNotifications.push(oNewNotification);
                }

                // Update the model
                oNotificationModel.setProperty("/Notifications", aNotifications);

                // Add logs
                console.log("New notification added:", oNewNotification);
                console.log("Updated notifications list:", oNotificationModel.getData().Notifications);
            }
        });
    });