sap.ui.define([
	"./Basecontroller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/format/DateFormat",
	"sap/m/MessageBox"

], function (Controller, JSONModel, Device, MessageToast, Fragment, Filter, FilterOperator, MessageBox, DateFormat) {
	"use strict";

	return Controller.extend("com.app.parkinglot.controller.Home1", {

		onInit: function () {
			var oModel = new JSONModel(sap.ui.require.toUrl("com/app/parkinglot/model/data.json"));
			this.getView().setModel(oModel);

			this._setParkingLotModel();
			this._setHistoryModel();

			var today = new Date();

			// Set the minimum date to tomorrow
			var tomorrow = new Date(today);
			tomorrow.setDate(today.getDate() + 1);

			// Set the minimum date for the date picker
			var oDateTimePicker = this.getView().byId("idinputdatepicker");
			oDateTimePicker.setMinDate(tomorrow);

			// Set display format to show only date
			oDateTimePicker.setDisplayFormat("yyyy-MM-dd");



			const oLocalModel = new JSONModel({
				VehicalDeatils: {
					vehicalNo: "",
					driverName: "",
					phone: "",
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
			if (oModelV2) {
				this.getView().byId("pageContainer").setModel(oModelV2);
			}
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

			//Assingning the current time to the vehicel data.
			const Intime = new Date;
			oPayload.VehicalDeatils.assignedDate = Intime;


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
			var phoneExists = await this.checkPhoneExists(oModel, trimmedPhone);
			if (phoneExists) {
				sap.m.MessageBox.error("Phone number already associated with another vehicle Please Check mobile number");
				return;
			};
			var isReserved = await this.checkParkingLotReservation(oModel, plotNo);
			if (isReserved) {
				sap.m.MessageBox.error(`Parking lot ${plotNo} is already reserved. Please select another parking lot.`, {
					title: "Reservation Information",
					actions: sap.m.MessageBox.Action.OK
				});
				return;
			};
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
		//validation for phone no checking
		checkPhoneExists: async function (oModel, trimmedPhone) {
			return new Promise((resolve, reject) => {
				oModel.read("/VehicalDeatils", {
					filters: [
						new sap.ui.model.Filter("phone", sap.ui.model.FilterOperator.EQ, trimmedPhone)
					],
					success: function (oData) {
						resolve(oData.results.length > 0);
					},
					error: function () {
						reject("An error occurred while checking phone number existence.");
					}
				});
			});
		},
		//validation for Vehicle no checking
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
		//validation for plotAvailability checking
		checkParkingLotReservation: async function (oModel, plotNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/Reservation", {
					filters: [
						new sap.ui.model.Filter("plotNo_plot_NO", sap.ui.model.FilterOperator.EQ, plotNo)
					],
					success: function (oData) {
						resolve(oData.results.length > 0);
					},
					error: function () {
						reject("An error occurred while checking parking lot reservation.");
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
			const that = this; // Store reference to 'this' for later use inside nested functions
			const oPayload = this.getView().byId("page1").getModel("localModel").getProperty("/");
			const { driverName, phone, vehicalNo, vehicalType } = this.getView().byId("page1").getModel("localModel").getProperty("/").VehicalDeatils;
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2"); // Assuming "ModelV2" is your ODataModel
			const plotNo = this.getView().byId("productInput").getValue();
			oPayload.VehicalDeatils.plotNo_plot_NO = plotNo;

			const newtime = new Date();
			oPayload.VehicalDeatils.unassignedDate = newtime;

			// Confirmation dialog before proceeding
			sap.m.MessageBox.confirm("Are you sure you want to unassign the parking lot?", {
				title: "Confirmation",
				onClose: async function (oAction) {
					if (oAction === sap.m.MessageBox.Action.OK) {
						try {
							await that.createData(oModel, oPayload.VehicalDeatils, "/History");

							await that.deleteData(oModel, "/VehicalDeatils", vehicalNo);

							const updatedParkingLot = {
								available: true // Assuming false represents empty parking
								// Add other properties if needed
							};
							oModel.update("/PlotNOs('" + plotNo + "')", updatedParkingLot, {
								success: function () {
									sap.m.MessageToast.show(`Vehicle ${vehicalNo} unassigned and parking lot ${plotNo} is now available`);
								},
								error: function (oError) {
									sap.m.MessageBox.error("Failed to update : " + oError.message);
								}
							});
							// this.onclearPress1();
						} catch (error) {
							sap.m.MessageBox.error("Some technical Issue");
						}
					}
				}
			});
		},
		//Print function
		OnPrintpress: async function () {
			debugger
			var oSelected = this.byId("AssignedSlotsTable").getSelectedItems();
			if (oSelected.length === 0) {
				MessageBox.error("Please Select atleast one Book to Edit");
				return
			};

			var oSelect = oSelected[0]
			if (oSelect) {
				var ovehicalNo = oSelect.getBindingContext().getProperty("vehicalNo");
				var odriverName = oSelect.getBindingContext().getProperty("driverName");
				var ophone = oSelect.getBindingContext().getProperty("phone");
				var ovehicalType = oSelect.getBindingContext().getProperty("vehicalType");
				var oassignedDate = oSelect.getBindingContext().getProperty("assignedDate");
				var oplotNo = oSelect.getBindingContext().getProperty("plotNo");
			};
			if (!this.oprint) {
				this.oprint = await Fragment.load({
					id: this.getView().getId(),
					name: "com.app.parkinglot.fragment.print",
					controller: this
				});
				this.getView().addDependent(this.oprint);
			}

			this.oprint.open();
		},
		onCloseDialog: function () {
			var oDialog = this.byId("idprintparking");
			if (oDialog) {
				oDialog.close();
			}
		},
		//vehicel submission details are alredy in 
		vehiclesubmit: function (oEvent) {
			debugger
			const oLocalModel = this.getView().byId("page1").getModel("localModel");
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2");
			const svehicalNo = oEvent.getParameter("value");

			oModel.read("/VehicalDeatils", {
				filters: [
					new Filter("vehicalNo", FilterOperator.EQ, svehicalNo)
				],
				success: function (oData) {
					var aVehicles = oData.results;
					if (aVehicles.length > 0) {
						// Assuming there's only one record with unique vehicalNo
						var oVehicle = aVehicles[0];
						// Set other fields based on the found vehicle
						oLocalModel.setProperty("/VehicalDeatils/vehicalNo", oVehicle.vehicalNo);
						oLocalModel.setProperty("/VehicalDeatils/driverName", oVehicle.driverName);
						oLocalModel.setProperty("/VehicalDeatils/phone", oVehicle.phone);
						oLocalModel.setProperty("/VehicalDeatils/vehicalType", oVehicle.vehicalType);
						oLocalModel.setProperty("/VehicalDeatils/assignedDate", oVehicle.assignedDate);
						this.oView.byId("productInput").setValue(oVehicle.plotNo_plot_NO)
						// Set other fields as needed
					} else {
						// Handle case where vehicle number was not found
						sap.m.MessageToast.show("Vehicle number not found.");
						// Optionally clear other fields
						oLocalModel.setProperty("/VehicalDeatils/vehicalNo", "");
						oLocalModel.setProperty("/VehicalDeatils/driverName", "");
						oLocalModel.setProperty("/VehicalDeatils/phone", "");
						oLocalModel.setProperty("/VehicalDeatils/vehicalType", "");
						oLocalModel.setProperty("/VehicalDeatils/assignedDate", "");
						// Clear other fields as needed
					}
				}.bind(this),
				error: function (oError) {
					sap.m.MessageToast.show("Error fetching vehicle details: " + oError.message);
				}

			})
		},
		//Edit function
		onEditpress: function (oEvent) {
			debugger;
			var oButton = oEvent.getSource();
			var sButtonText = oButton.getText();

			var oRow = oButton.getParent(); // Get the table row
			var oCell = oRow.getCells()[4]; // Assuming the 5th cell contains both Text and ComboBox

			var oText = oCell.getItems()[0]; // Assuming the first item is Text
			var oComboBox = oCell.getItems()[1]; // Assuming the second item is ComboBox

			if (sButtonText === "Edit") {
				// Switching to edit mode
				oButton.setText("Submit");
				oText.setVisible(false);
				oComboBox.setVisible(true);
				oComboBox.setEditable(true);
			} else {
				// Switching back to display mode
				oButton.setText("Edit");
				oText.setVisible(true);
				oComboBox.setVisible(false);
				oComboBox.setEditable(false);

				var otemp = oButton.getParent().getBindingContext().getObject().vehicalNo;
				var oval = oText.getValue(); // Old plotNo
				var oc = oComboBox.getSelectedKey(); // New plotNo
				var oModel = this.getView().getModel("ModelV2");
				var that = this;

				// Update VehicalDeatils entity
				oModel.update("/VehicalDeatils('" + otemp + "')", { plotNo_plot_NO: oc }, {
					success: function () {
						sap.m.MessageToast.show("VehicalDeatils updated successfully!");

						// Update PlotNOs entities sequentially
						oModel.update("/PlotNOs('" + oval + "')", { available: true }, {
							success: function () {
								// Now update the new plotNo
								oModel.update("/PlotNOs('" + oc + "')", { available: false }, {
									success: function () {
										sap.m.MessageToast.show("PlotNOs updated successfully!");
										oModel.refresh(true);
										that.getView().byId("AssignedSlotsTable").getBinding("items").refresh(true);
									},
									error: function () {
										sap.m.MessageBox.error("Error occurs while updating new plotNo availability!");
									}
								});
							},
							error: function () {
								sap.m.MessageBox.error("Error occurs while updating old plotNo availability!");
							}
						});
					},
					error: function () {
						sap.m.MessageBox.error("Error occurs while updating VehicalDeatils!");
					}
				});
			}
		},
		//Parking lot Reservations
		onReservePressbtn: async function () {
			var oView = this.getView();
			const oModel = oView.byId("pageContainer").getModel("ModelV2");


			var sVehicleNo = oView.byId("InputVehicleno").getValue();
			var sDriverName = oView.byId("InputDriverName").getValue();
			var sPhoneNo = oView.byId("InputPhonenumber").getValue();
			var sVehicleType = oView.byId("InputVehicletype").getValue();
			var sParkingLot = oView.byId("idcombox1").getValue();
			var oDateTimePicker = oView.byId("idinputdatepicker");
			var oSelectedDateTime = oDateTimePicker.getDateValue();

			// Validation for Phone Number
			if (!sPhoneNo || !sPhoneNo.match(/^[9876]\d{9}$/)) {
				sap.m.MessageBox.error("Please enter a valid phone number starting with 9, 8, 7, or 6 and exactly 10 digits.");
				return;
			}

			// Validation for Vehicle Number
			if (!sVehicleNo || !sVehicleNo.match(/^[\w\d]{1,10}$/)) {
				sap.m.MessageBox.error("Please enter a valid vehicle number (alphanumeric, up to 10 characters).");
				return;
			}

			// Validation for Vehicle Type
			if (sVehicleType !== "inward" && sVehicleType !== "outward") {
				sap.m.MessageBox.error("Please enter either 'inward' or 'outward' for vehicle type.");
				return;
			}

			// Check if Vehicle Number already exists
			const vehicleExists = await this.checkVehicleExists(oModel, sVehicleNo);
			if (vehicleExists) {
				sap.m.MessageBox.error("Vehicle number already exists. Please enter a different vehicle number.");
				return;
			}

			// Construct payload for reservation entity
			var newmodel = new sap.ui.model.json.JSONModel({
				vehicalNo: sVehicleNo,
				driverName: sDriverName,
				phone: sPhoneNo,
				vehicalType: sVehicleType,
				plotNo_plot_NO: sParkingLot,
				Expectedtime: oSelectedDateTime
			});

			this.getView().byId("page8").setModel(newmodel, "newmodel");
			const oPayload = this.getView().byId("page8").getModel("newmodel").getProperty("/");

			// Call OData service to create reservation
			try {
				await this.createData(oModel, oPayload, "/Reservation");
				sap.m.MessageBox.success("Parking lot reserved  successfully");
			} catch (error) {
				sap.m.MessageBox.error("Failed to create reservation. Please try again.");
				console.error("Error creating reservation:", error);
			}
		},

		// Function to check if vehicle number exists in backend
		// Function to check if vehicle number exists in backend
		checkVehicleExists: async function (oModel, sVehicleNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/VehicalDeatils", {
					filters: [
						new Filter("vehicalNo", FilterOperator.EQ, sVehicleNo)
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
		onReservePressbtnclear: function () {
			var oView = this.getView();
			oView.byId("InputVehicleno").setValue("");
			oView.byId("InputDriverName").setValue("");
			oView.byId("InputPhonenumber").setValue("");
			oView.byId("InputVehicletype").setValue("");
			oView.byId("idcombox1").setValue("");
			oView.byId("idinputdatepicker").setValue(null); // Clear the date picker
		},
		//Reservation lot allocation
		onpressassignrd: async function () {
			debugger
			var oSelected = this.byId("ReservationTable").getSelectedItems();
			if (oSelected.length === 0) {
				MessageBox.error("Please Select atleast row to Assign");
				return
			};

			var oSelectedRow = this.byId("ReservationTable").getSelectedItem().getBindingContext().getObject();
			var orow = this.byId("ReservationTable").getSelectedItem().getBindingContext().getPath();
			const intime = new Date;
			var resmodel = new JSONModel({
				vehicalNo: oSelectedRow.vehicalNo,
				driverName: oSelectedRow.driverName,
				phone: oSelectedRow.phone,
				vehicalType: oSelectedRow.vehicalType,
				assignedDate: intime,
				plotNo_plot_NO: oSelectedRow.plotNo_plot_NO,

			});
			var temp = oSelectedRow.plotNo_plot_NO;

			const oModel = this.getView().byId("pageContainer").getModel("ModelV2");
			debugger
			this.getView().byId("page8").setModel(resmodel, "resmodel");
			this.getView().byId("page8").getModel("resmodel").getProperty("/");
			oModel.create("/VehicalDeatils", resmodel.getData(), {
				success: function (odata) {
					debugger
					oModel.remove(orow, {
						success: function () {
							oModel.refresh()
							oModel.update("/PlotNOs('" + temp + "')", { available: false }, {
								success: function () {
									sap.m.MessageBox.success(`Reserved Vehicle ${oSelectedRow.vehicalNo} assigned successfully to plot ${oSelectedRow.plotNo_plot_NO}.`);
									oModel.refresh();
								}, error: function () {
									sap.m.MessageBox.error("HBJKLJHGVhb");
								}

							})
						},
						error: function (oError) {
							sap.m.MessageBox.error("Failed to update : " + oError.message);
						}

					})

				},
				error: function (oError) {
					sap.m.MessageBox.error("Failed to update : " + oError.message);
				}
			})
		},
		//function for the pie chart
		_setParkingLotModel: function () {
			var oModel = this.getOwnerComponent().getModel("ModelV2");
			var that = this;

			oModel.read("/PlotNOs", {
				success: function (oData) {
					console.log("Fetched Data:", oData);
					var aItems = oData.results;
					var availableCount = aItems.filter(item => item.available === true).length;
					var occupiedCount = aItems.filter(item => item.available === false).length;

					var aChartData = {
						Items: [
							{
								available: true,
								Count: availableCount,
								available: "Empty Lots",

							},
							{
								available: false,
								Count: occupiedCount,
								available: "Not Empty Lots"
							}
						]
					};
					var oParkingLotModel = new JSONModel();
					oParkingLotModel.setData(aChartData);
					that.getView().setModel(oParkingLotModel, "ParkingLotModel");
				},
				error: function (oError) {
					console.error(oError);
				}
			});
		},
		_setHistoryModel: function () {
			var oModel = this.getOwnerComponent().getModel("ModelV2");
			var that = this;

			oModel.read("/History", {
				success: function (oData) {
					console.log("Fetched Data:", oData);
					var aItems = oData.results;

					var oProcessedData = that._processHistoryData(aItems);

					var oHistoryModel = new JSONModel();
					oHistoryModel.setData(oProcessedData);
					that.getView().setModel(oHistoryModel, "HistoryModel");
				},
				error: function (oError) {
					console.error(oError);
				}
			});
		},

		_processHistoryData: function (aItems) {
			var oData = {};

			aItems.forEach(function (item) {
				var date = new Date(item.assignedDate).toISOString().split("T")[0]; // Convert date to ISO string and extract date part

				if (!oData[date]) {
					oData[date] = {
						date: date,
						inwardCount: 0,
						outwardCount: 0
					};
				}

				if (item.vehicalType === "inward") {
					oData[date].inwardCount += 1;
				} else if (item.vehicalType === "outward") {
					oData[date].outwardCount += 1;
				}
			});

			return {
				Items: Object.values(oData)
			};
		},

		onSelectData: function (oEvent) {
			var oSelectedData = oEvent.getParameter("data")[0].data;
			sap.m.MessageToast.show("Selected Date: " + oSelectedData.date + "\nInward Count: " + oSelectedData.inwardCount + "\nOutward Count: " + oSelectedData.outwardCount);
		},

		handleRenderComplete: function (oEvent) {
			console.log("Chart rendering complete.");
		},
		onSearch: function (event) {
			debugger
			var sQuery = event.getSource().getValue();
			var oTable = this.byId("ReservationTable");
			var oBinding = oTable.getBinding("items");

			if (oBinding) {
				var oFilter = new sap.ui.model.Filter([
					new Filter("plotNo_plot_NO", FilterOperator.Contains, sQuery),
					new Filter("vehicalNo", FilterOperator.Contains, sQuery),
					new Filter("driverName", FilterOperator.Contains, sQuery)
				], false);
				oBinding.filter(oFilter);
			}

		}
	});
});
