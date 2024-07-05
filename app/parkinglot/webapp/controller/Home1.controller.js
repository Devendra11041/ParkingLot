sap.ui.define([
	"./Basecontroller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox"

], function (Controller, JSONModel, Device, MessageToast, Fragment, Filter, FilterOperator, MessageBox) {
	"use strict";

	return Controller.extend("com.app.parkinglot.controller.Home1", {

		onInit: function () {
			var oModel = new JSONModel(sap.ui.require.toUrl("com/app/parkinglot/model/data.json"));
			this.getView().setModel(oModel);

			const oLocalModel = new JSONModel({
				VehicalDeatils: {
					vehicalNo: "",
					driverName: "",
					phone: 0,
					vehicalType: "",
					assignedDate: "",
					unassignedDate: "",
					plotNo_plot_NO: "",
				},
				plotNo: {
					available: false
				}
			});
			this.getView().setModel(oLocalModel, "localModel");

			var oModelV2 = this.getOwnerComponent().getModel("ModelV2");
			this.getView().byId("pageContainer").setModel(oModelV2);

		},

		onItemSelect: function (oEvent) {
			var oItem = oEvent.getParameter("item");
			this.byId("pageContainer").to(this.getView().createId(oItem.getKey()));
		},

		onExit: function () {
			Device.media.detachHandler(this._handleMediaChange, this);
		},
		statusTextFormatter: function (bStatus) {
			return bStatus ? "Empty" : "Not Empty"; // Modify as per your requirement
		},

		//
		onValueHelpRequest: function (oEvent) {
			var sInputValue = oEvent.getSource().getValue(),
				oView = this.getView();

			if (!this._pValueHelpDialog) {
				this._pValueHelpDialog = Fragment.load({
					id: oView.getId(),
					name: "com.app.parkinglot.fragment.valuhelp",
					controller: this
				}).then(function (oDialog) {
					oView.addDependent(oDialog);
					return oDialog;
				});
			}
			this._pValueHelpDialog.then(function (oDialog) {
				// Create a filter for the binding
				oDialog.setModel(this.getView().getModel("ModelV2"));
				oDialog.getBinding("items").filter([new Filter("plot_NO", FilterOperator.Contains, sInputValue)]);
				// Open ValueHelpDialog filtered by the input's value
				oDialog.open(sInputValue);
			}.bind(this));
		},

		onValueHelpDialogSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("plot_NO", FilterOperator.Contains, sValue);

			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onValueHelpDialogClose: function (oEvent) {
			var sDescription,
				oSelectedItem = oEvent.getParameter("selectedItem");
			oEvent.getSource().getBinding("items").filter([]);

			if (!oSelectedItem) {
				return;
			}

			sDescription = oSelectedItem.getDescription();

			this.byId("productInput").setSelectedKey(sDescription);
		},

		//Assign the vehicel to the parking lot
		onAssignPress: async function () {
			const oPayload = this.getView().byId("page1").getModel("localModel").getProperty("/");
			const { driverName, phone, vehicalNo, vehicalType } = this.getView().byId("page1").getModel("localModel").getProperty("/").VehicalDeatils;
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2"); // Assuming "ModelV2" is your ODataModel
			const plotNo = this.getView().byId("productInput").getValue();
			oPayload.VehicalDeatils.plotNo_plot_NO = plotNo;
			
			if (!(driverName && phone && vehicalNo && vehicalType && plotNo)) {
				MessageToast.show("Enter all details")
				return
			}
			var trimmedPhone = phone.trim();

			// Validate phone number
			var phoneRegex = /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[789]\d{9}$/;
			if (!(phoneRegex.test(trimmedPhone))) {
				MessageToast.show("Please enter a valid phone number");
				return;
			}

			var oVehicleExist = await this.checkVehicleNo(oModel, oPayload.VehicalDeatils.vehicalNo)
			if (oVehicleExist) {
				MessageToast.show("Vehicle already exsist")
				return
			};
			const plotAvailability = await this.checkPlotAvailability(oModel, plotNo);
			if (!plotAvailability) {
				sap.m.MessageBox.information(`${plotNo} is not available now.Choose another Parking Lot.`,
					{
						title: "Allocation Information",
						actions: sap.m.MessageBox.Action.OK
					}
				);
				return;
			}

			try {
				// Assuming createData method sends a POST request
				await this.createData(oModel, oPayload.VehicalDeatils, "/VehicalDeatils");
				//await this.createData(oModel, oPayload.VehicalDeatils, "/History");
				sap.m.MessageBox.information(
					`Vehicel No ${vehicalNo} allocated to Slot No ${plotNo}`,
					{
						title: "Allocation Information",
						actions: sap.m.MessageBox.Action.OK
					}
				);
				oModel.update("/PlotNOs('" + plotNo + "')", oPayload.plotNo, {
					success: function () {

					}.bind(this),
					error: function (oError) {

						sap.m.MessageBox.error("Failed to update: " + oError.message);
					}.bind(this)
				});

			} catch (error) {
				console.error("Error:", error);
			}
		},
		checkVehicleNo: async function (oModel, sVehicalNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/VehicalDeatils", {
					filters: [
						new Filter("vehicalNo", FilterOperator.EQ, sVehicalNo),

					],
					success: function (oData) {
						resolve(oData.results.length > 0);
					},
					error: function () {
						reject(
							"An error occurred while checking username existence."
						);
					}
				})
			})
		},
		checkPlotAvailability: async function (oModel, plotNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/PlotNOs('" + plotNo + "')", {
					success: function (oData) {
						resolve(oData.available);
					},
					error: function (oError) {
						reject("Error checking plot availability: " + oError.message);
					}
				});
			});
		},
		checkPlotEmpty: async function (oModel, sVehicalNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/VehicalDeatils", {
					filters: [
						new Filter("vehicalNo", FilterOperator.EQ, sVehicalNo),

					],
					success: function (oData) {
						resolve(oData.results.length > 0);
					},
					error: function () {
						reject(
							"An error occurred while checking username existence."
						);
					}
				})
			})
		},

		// Clear the local model's VehicalDeatils property
		onclearPress: function () {
			var oLocalModel = this.getView().getModel("localModel");
			oLocalModel.setProperty("/VehicalDeatils", {
				vehicalNo: "",
				driverName: "",
				phone: "",
				vehicalType: "",
				plotNo_plot_NO: ""
			});

			// Clear any other necessary fields or models
			this.getView().byId("productInput").setValue("");
		},
		onUnassignPress1: async function () {
			const oPayload = this.getView().byId("page1").getModel("localModel").getProperty("/");
			const { driverName, phone, vehicalNo, vehicalType } = this.getView().byId("page1").getModel("localModel").getProperty("/").VehicalDeatils;
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2"); // Assuming "ModelV2" is your ODataModel
			const plotNo = this.getView().byId("productInput").getValue();
			oPayload.VehicalDeatils.plotNo_plot_NO = plotNo;
			const newtime = new Date;
			oPayload.VehicalDeatils.unassignedDate = newtime;
			try {
				await this.createData(oModel, oPayload.VehicalDeatils, "/History");
				sap.m.MessageBox.success("vehicel unassigend ")
				await this.deleteData(oModel,  vehicalNo, "/VehicalDeatils");
				oModel.update("/PlotNOs('" + plotNo + "')", oPayload.plotNo, {
					success: function () {

					},
					error: function (oError) {

						sap.m.MessageBox.error("Failed to update : " + oError.message);
					}
				});
			} catch (error) {

				sap.m.MessageBox.error("Some technical Issue");
			}
		
		}
	});
});
