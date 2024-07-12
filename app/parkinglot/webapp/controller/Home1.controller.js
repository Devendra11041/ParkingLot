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
			const plotAvailability = await this.checkPlotAvailability(oModel, plotNo);
			if (!plotAvailability) {
				sap.m.MessageBox.information(`${plotNo} is not available now.Choose another Parking Lot.`,
					{
						title: "Allocation Information",
						actions: sap.m.MessageBox.Action.OK
					}
				);
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
						} catch (error) {
							sap.m.MessageBox.error("Some technical Issue");
						}
					}
				}
			});
		},
		OnPrintpress: async function () {
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
		onUnassignPress: function (oEvent) {
			var oButton = oEvent.getSource();
			var oContext = oButton.getBindingContext();
			var oModel = oContext.getModel();
			var oListItem = oButton.getParent().getParent(); // Accessing the ColumnListItem

			var sButtonText = oButton.getText();
			var bIsEditing = (sButtonText === "Edit");


			if (bIsEditing) {
				// Switch to Submit mode
				oButton.setText("Submit");
				var oRow = oButton.getParent(); // Assuming the button is directly inside a table row
				var oCell = oRow.getCells()[4]; // Accessing the 5th cell (index 4) in the row
				oCell.setEditable(true);

				// Example: Enable inputs for editing
				var oCells = oListItem.getCells();
				for (var i = 0; i < oCells.length; i++) {
					var oCell = oCells[i];
					if (oCell instanceof sap.m.Input) {
						oCell.setEditable(true);
					}
				}
			} else {
				// Handle Submit logic
				// Example: Disable inputs after submission
				var oCells = oListItem.getCells();
				for (var i = 0; i < oCells.length; i++) {
					var oCell = oCells[i];
					if (oCell instanceof sap.m.Input) {
						oCell.setEditable(false);
					}
				}

				// Save changes or perform further actions
				// For example, update the model or show a success message
				oModel.submitChanges({
					success: function () {
						MessageBox.success("Changes saved successfully!");
					},
					error: function () {
						MessageBox.error("Failed to save changes.");
					}
				});

				// Switch back to Edit mode
				oButton.setText("Edit");
			}
		},
		onReservePressbtn: async function () {
			var oView = this.getView();
			const oModel = oView.byId("pageContainer").getModel("ModelV2");

			// Get input values
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
		}
	});
});
