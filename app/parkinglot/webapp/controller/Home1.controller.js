sap.ui.define([
	"./Basecontroller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/m/MessageBox",
	"sap/ndc/BarcodeScanner"

], function (Controller, JSONModel, Device, MessageToast, Fragment, Filter, ODataModel, FilterOperator, MessageBox, DateFormat, BarcodeScanner) {
	"use strict";

	return Controller.extend("com.app.parkinglot.controller.Home1", {

		onInit: function () {
			var oModel = new JSONModel(sap.ui.require.toUrl("com/app/parkinglot/model/data.json"));
			this.getView().setModel(oModel);

			var oNotificationModel = new sap.ui.model.json.JSONModel({
				Notifications: []
			});
			this.getView().setModel(oNotificationModel, "NotificationModel");

			this._setParkingLotModel();
			this._setHistoryModel();
			this.loadParkingLots();

			var today = new Date();

			// Set the minimum date to tomorrow
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
		// statusTextFormatter: function (bStatus) {
		// 	return bStatus ? "Empty" : "Not Empty"; // Modify as per your requirement
		// },

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
				oDialog.getBinding("items").filter([new Filter("plot_NO", sap.ui.model.FilterOperator.Contains, sInputValue)]);
				// Open ValueHelpDialog filtered by the input's value
				oDialog.open(sInputValue);
			}.bind(this));
		},

		onValueHelpDialogSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("plot_NO", sap.ui.model.FilterOperator.Contains, sValue);

			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onValueHelpDialogClose: function (oEvent) {
			debugger
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
			debugger
			const oPayload = this.getView().byId("page1").getModel("localModel").getProperty("/");
			const { driverName, phone, vehicalNo } = this.getView().byId("page1").getModel("localModel").getProperty("/").VehicalDeatils;
			const vehicalType = this.getView().byId("idselectvt").getSelectedKey();
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2"); // Assuming "ModelV2" is your ODataModel
			const plotNo = this.getView().byId("productInput").getValue();
			oPayload.VehicalDeatils.plotNo_plot_NO = plotNo;
			oPayload.VehicalDeatils.vehicalType = vehicalType;

			//Assingning the current time to the vehicel data.
			const Intime = new Date;
			oPayload.VehicalDeatils.assignedDate = Intime;


			if (!(driverName && phone && vehicalNo && vehicalType && plotNo)) {
				MessageToast.show("Enter all details")
				return
			}
			var trimmedPhone = phone.trim();

			// Validate phone number
			var phoneRegex = /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[6789]\d{9}$/;
			if (!(phoneRegex.test(trimmedPhone))) {
				MessageToast.show("Please enter a valid phone number");
				return;
			};
			var truckno = /^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/;
			if (!(truckno.test(vehicalNo))) {
				MessageToast.show("Please check Vehicle Number Once");
				return;
			};

			debugger
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
			var oplotnoexists = await this.plotnoexists(oModel, plotNo)

			if (!oplotnoexists) {
				MessageToast.show("Please Select Valid Plotn No")
				return
			};
			var plotAssigned = await this.checkIfExists(oModel, "/VehicalDeatils", "plotNo_plot_NO", oPayload.VehicalDeatils.plotNo_plot_NO);
       
            if (plotAssigned) {
                MessageToast.show(" plot Number or Phone number already assigned ");
                return;
            };
		

			try {
				// Assuming createData method sends a POST request
				await this.createData(oModel, oPayload.VehicalDeatils, "/VehicalDeatils");
				//await this.createData(oModel, oPayload.VehicalDeatils, "/History");

				//   start SMS
				const accountSid = "ACfcd333bcb3dc2c2febd267ce455a6762"
				const authToken = "ea44ceea6205dd2864f4b5beb40d31c0"

				// debugger
				const toNumber = `+91${phone}`
				const fromNumber = '+13613109079';
				const messageBody = `Hi ${driverName} a Slot number ${plotNo} is alloted to you vehicle number ${vehicalNo} \nKindly Move your vehicle to your allocated Parking lot. \nThank You,\nVishal Parking Management.`;

				// Twilio API endpoint for sending messages
				const url = ""


				// Send POST request to Twilio API using jQuery.ajax
				$.ajax({
					url: url,
					type: 'POST',
					async: true,
					headers: {
						'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
					},
					data: {
						To: toNumber,
						From: fromNumber,
						Body: messageBody
					},
					success: function (data) {
						MessageToast.show('if number exists SMS will be sent!');
					},
					error: function (error) {
						MessageToast.show('Failed to send SMS: ' + error);
					}
				});

				// sms end

				// Function to make an announcement
				function makeAnnouncement(message, lang = 'en-US') {
					// Check if the browser supports the Web Speech API
					if ('speechSynthesis' in window) {
						// Create a new instance of SpeechSynthesisUtterance
						var utterance = new SpeechSynthesisUtterance(message);

						// Set properties (optional)
						utterance.pitch = 1; // Range between 0 (lowest) and 2 (highest)
						utterance.rate = 0.75;  // Range between 0.1 (lowest) and 10 (highest)
						utterance.volume = 1; // Range between 0 (lowest) and 1 (highest)
						utterance.lang = lang; // Set the language

						// Speak the utterance
						debugger
						window.speechSynthesis.speak(utterance);

					} else {
						console.log('Sorry, your browser does not support the Web Speech API.');
					}

				}

				// Example usage
				//makeAnnouncement(`कृपया ध्यान दें। वाहन नंबर ${vehicalNo} को स्लॉट नंबर ${plotNo} द्वारा आवंटित किया गया है।`, 'hi-IN');
				makeAnnouncement(`దయచేసి వినండి. వాహనం నంబర్ ${vehicalNo} కు స్లాట్ నంబర్ ${plotNo} కేటాయించబడింది.`, 'te-IN');

				var oVehicleExist = await this.checkVehicleNo(oModel, oPayload.VehicalDeatils.vehicalNo)

				sap.m.MessageToast.show(
					`Vehicel No ${vehicalNo} allocated to Slot No ${plotNo}`,
				);

				const updatedParkingLot = {
					available: "Not Empty" // Assuming false represents empty parking
					// Add other properties if needed
				};
				oModel.update("/PlotNOs('" + plotNo + "')", updatedParkingLot, {
					success: function () {

					}.bind(this),
					error: function (oError) {

						sap.m.MessageBox.error("Failed to update: " + oError.message);
					}.bind(this)
				});
				this.triggerPrintForm(oPayload.VehicalDeatils);
			} catch (error) {
				console.error("Error:", error);
			}
			this.onclearvalues();

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
						new sap.ui.model.Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, sVehicalNo)
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
		checkIfExists: async function (oModel, sEntitySet, sProperty, sValue) {
            return new Promise((resolve, reject) => {
                oModel.read(sEntitySet, {
                    filters: [new sap.ui.model.Filter(sProperty, sap.ui.model.FilterOperator.EQ, sValue)],
                    success: (oData) => {
                        resolve(oData.results.length > 0);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },
		//Validation for plot checking
		plotnoexists: async function (oModel, splotNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/PlotNOs", {
					filters: [
						new sap.ui.model.Filter("plot_NO", sap.ui.model.FilterOperator.EQ, splotNo)
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

		//validation for plotAvailability checking
		checkReservation: async function (oModel, sVehicalNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/Reservation", {
					filters: [
						new sap.ui.model.Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, sVehicalNo)
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
						new Filter("plotNo_plot_NO", FilterOperator.EQ, sVehicalNo),

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
		onclearvalues: function () {
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

			try {
				await that.createData(oModel, oPayload.VehicalDeatils, "/History");

				await that.deleteData(oModel, "/VehicalDeatils", vehicalNo);

				//   start SMS
				const accountSid = ""
				const authToken = ""

				// debugger
				const toNumber = `+91${phone}`
				const fromNumber = '+13613109079';
				const messageBody = `Hi ${driverName},\n\nYour vehicle with registration number ${vehicalNo} was previously parked in Slot number ${plotNo}.Please remove your vehicle from the parking lot at your earliest convenience..\n\nPlease ignore this message if you have already removed your vehicle from the parking lot.\n\nThank you,\nVishal Parking Management.`;


				// Twilio API endpoint for sending messages
				const url = ""


				// Send POST request to Twilio API using jQuery.ajax
				$.ajax({
					url: url,
					type: 'POST',
					async: true,
					headers: {
						'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
					},
					data: {
						To: toNumber,
						From: fromNumber,
						Body: messageBody
					},
					success: function (data) {
						MessageToast.show('if number exists SMS will be sent!');
					},
					error: function (error) {
						MessageToast.show('Failed to send SMS: ' + error);
					}
				});

				// sms endR


				const updatedParkingLot = {
					available: "Empty" // Assuming false represents empty parking
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
				this.onclearvalues();
			} catch (error) {
				sap.m.MessageBox.error("Some technical Issue");
			}
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
			debugger;
			const oLocalModel = this.getView().byId("page1").getModel("localModel");
			const oModel = this.getView().byId("pageContainer").getModel("ModelV2");
			const svehicalNo = oEvent.getParameter("value");

			// Function to set vehicle details in the local model
			const setVehicleDetails = (oVehicle) => {
				oLocalModel.setProperty("/VehicalDeatils/vehicalNo", oVehicle.vehicalNo);
				oLocalModel.setProperty("/VehicalDeatils/driverName", oVehicle.driverName);
				oLocalModel.setProperty("/VehicalDeatils/phone", oVehicle.phone);
				oLocalModel.setProperty("/VehicalDeatils/vehicalType", oVehicle.vehicalType);
				oLocalModel.setProperty("/VehicalDeatils/assignedDate", oVehicle.assignedDate);
				this.oView.byId("productInput").setValue(oVehicle.plotNo_plot_NO)
			};

			// Function to clear vehicle details in the local model
			const clearVehicleDetails = () => {
				oLocalModel.setProperty("/VehicalDeatils/vehicalNo", "");
				oLocalModel.setProperty("/VehicalDeatils/driverName", "");
				oLocalModel.setProperty("/VehicalDeatils/phone", "");
				oLocalModel.setProperty("/VehicalDeatils/vehicalType", "");
				oLocalModel.setProperty("/VehicalDeatils/assignedDate", "");
				oLocalModel.setProperty("/VehicalDeatils/plotNo_plot_NO", "");
			};

			// Read from VehicalDeatils entity
			oModel.read("/VehicalDeatils", {
				filters: [new Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, svehicalNo)],
				success: function (oData) {
					var aVehicles = oData.results;
					if (aVehicles.length > 0) {
						// Vehicle found in VehicalDeatils
						var oVehicle = aVehicles[0];
						setVehicleDetails(oVehicle);
					} else {
						// If not found in VehicalDeatils, check in Reservation
						oModel.read("/Reservation", {
							filters: [new Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, svehicalNo)],
							success: function (oData) {
								var aReservations = oData.results;
								if (aReservations.length > 0) {
									// Vehicle found in Reservation
									var oReservation = aReservations[0];
									// Assuming Reservation entity has similar fields
									var oVehicleDetails = {
										vehicalNo: oReservation.vehicalNo,
										driverName: oReservation.driverName,
										phone: oReservation.phone,
										vehicalType: oReservation.vehicalType,
										assignedDate: oReservation.Expectedtime, // Adjust this field if necessary
										plotNo_plot_NO: oReservation.plotNo_plot_NO
									};
									setVehicleDetails(oVehicleDetails);
								} else {
									// Vehicle not found in both entities
									sap.m.MessageToast.show("Vehicle number not found.");
									clearVehicleDetails();
								}
							}.bind(this),
							error: function (oError) {
								sap.m.MessageToast.show("Error fetching reservation details: " + oError.message);
							}
						});
					}
				}.bind(this),
				error: function (oError) {
					sap.m.MessageToast.show("Error fetching vehicle details: " + oError.message);
				}
			});
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
						oModel.update("/PlotNOs('" + oval + "')", { available: "Empty" }, {
							success: function () {
								// Now update the new plotNo
								oModel.update("/PlotNOs('" + oc + "')", { available: "Not Empty" }, {
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
			debugger
			var oView = this.getView();
			const oModel = oView.byId("pageContainer").getModel("ModelV2");


			var sVehicleNo = oView.byId("InputVehicleno").getValue();
			var sDriverName = oView.byId("InputDriverName").getValue();
			var sPhoneNo = oView.byId("InputPhonenumber").getValue();
			var sVehicleType = oView.byId("InputVehicletype").getSelectedKey();
			var sParkingLot = oView.byId("idcombox1").getValue();
			var oDateTimePicker = oView.byId("idinputdatepicker");
			var oSelectedDateTime = oDateTimePicker.getDateValue();

			// Validation for Phone Number
			if (!sPhoneNo || !sPhoneNo.match(/^[9876]\d{9}$/)) {
				sap.m.MessageBox.error("Please enter a valid phone number starting with 9, 8, 7, or 6 and exactly 10 digits.");
				return;
			}

			var trucknoreserve = /^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/;
			if (!(trucknoreserve.test(sVehicleNo))) {
				MessageToast.show("Please check Vehicle Number Once");
				return;
			}

			// Validation for Vehicle Number
			if (!sVehicleNo || !sVehicleNo.match(/^[\w\d]{1,10}$/)) {
				sap.m.MessageBox.error("Please enter a valid vehicle number (alphanumeric, up to 10 characters).");
				return;
			}

			// Check if Vehicle Number already exists
			const vehicleExists = await this.checkVehicleExists(oModel, sVehicleNo);
			if (vehicleExists) {
				sap.m.MessageBox.error("Vehicle number already exists. Please enter a different vehicle number.");
				return;
			};
			var oplotno = await this.plotnovalidation(oModel, sParkingLot)
			if (!oplotno) {
				MessageToast.show("Please Select Valid Plotn No")
				return
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

				const updatedParkingLot = {
					available: "Reserved" // Assuming false represents empty parking
					// Add other properties if needed
				};

				oModel.update("/PlotNOs('" + sParkingLot + "')", updatedParkingLot, {
					success: function () {
						sap.m.MessageBox.success("Parking lot reserved  successfully");
					}.bind(this),
					error: function (oError) {

						sap.m.MessageBox.error("Failed to update: " + oError.message);
					}.bind(this)
				});

			} catch (error) {
				sap.m.MessageBox.error("Failed to create reservation. Please try again.");
				console.error("Error creating reservation:", error);
			} this.onclearreservations();
		},

		// Function to check if vehicle number exists in backend
		// Function to check if vehicle number exists in backend
		plotnovalidation: async function (oModel, splotNo) {
			return new Promise((resolve, reject) => {
				oModel.read("/PlotNOs", {
					filters: [
						new sap.ui.model.Filter("plot_NO", sap.ui.model.FilterOperator.EQ, splotNo)
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
		//
		onclearreservations: function () {
			this.getView().byId("InputVehicleno").setValue("");
			this.getView().byId("InputDriverName").setValue("");
			this.getView().byId("InputPhonenumber").setValue("");
			this.getView().byId("InputVehicletype").setValue("");
			this.getView().byId("idcombox1").setValue("");
			this.getView().byId("idinputdatepicker").setValue("");
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
							oModel.update("/PlotNOs('" + temp + "')", { available: "Not Empty" }, {
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
					//   start SMS
					const accountSid = 'ACfcd333bcb3dc2c2febd267ce455a6762';
					const authToken = 'ea44ceea6205dd2864f4b5beb40d31c0';

					// debugger
					const toNumber = `+91${oSelectedRow.phone}`
					const fromNumber = '+13613109079';
					const messageBody = `Hi ${oSelectedRow.driverName},\n\nYour vehicle with registration number ${oSelectedRow.vehicalNo} was previously parked in Slot number ${oSelectedRow.plotNo_plot_NO}.Please remove your vehicle from the parking lot at your earliest convenience..\n\nPlease ignore this message if you have already removed your vehicle from the parking lot.\n\nThank you,\nVishal Parking Management.`;


					// Twilio API endpoint for sending messages
					const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;


					// Send POST request to Twilio API using jQuery.ajax
					$.ajax({
						url: url,
						type: 'POST',
						async: true,
						headers: {
							'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
						},
						data: {
							To: toNumber,
							From: fromNumber,
							Body: messageBody
						},
						success: function (data) {
							MessageToast.show('if number exists SMS will be sent!');
						},
						error: function (error) {
							MessageToast.show('Failed to send SMS: ' + error);
						}
					});

					// sms end

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
					var availableCount = aItems.filter(item => item.available === "Empty").length;
					var occupiedCount = aItems.filter(item => item.available === "Not Empty").length;
					var oReservedCount = aItems.filter(item => item.available === "Reserved").length;

					var aChartData = {
						Items: [
							{
								available: "Empty",
								Count: availableCount,
								available: `Empty Lots - ${availableCount}`,

							},
							{
								available: " Not Empty",
								Count: occupiedCount,
								available: `Not Empty Lots -${occupiedCount}`
							},
							{
								available: "Reserved",
								Count: oReservedCount,
								available: `Reserved -${oReservedCount}`
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
						outwardCount: 0,
						totalVehicle: 0
					};
				}

				if (item.vehicalType === "inward") {
					oData[date].inwardCount += 1;
				} else if (item.vehicalType === "outward") {
					oData[date].outwardCount += 1;
				}
				oData[date].totalVehicle = oData[date].inwardCount + oData[date].outwardCount;
			});

			return {
				Items: Object.values(oData)
			};
		},

		onSelectData: function (oEvent) {
			var aData = oEvent.getParameter("data");
			if (aData && aData.length > 0) {
				var oSelectedData = aData[0].data;
				sap.m.MessageToast.show(
					"Selected Date: " + oSelectedData.date +
					"\nInward Count: " + oSelectedData.inwardCount +
					"\nOutward Count: " + oSelectedData.outwardCount
				);
			} else {
				console.error("No data selected or data structure mismatch.");
			}
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
					new Filter("plotNo_plot_NO", sap.ui.model.FilterOperator.Contains, sQuery),
					new Filter("vehicalNo", sap.ui.model.FilterOperator.Contains, sQuery),
					new Filter("driverName", sap.ui.model.FilterOperator.Contains, sQuery)
				], false);
				oBinding.filter(oFilter);
			}

		},
		//Notification fragment 
		OnpressNotify: async function (oEvent) {
			var oButton = oEvent.getSource(),
				oView = this.getView();
			if (!this._pPopover) {
				this._pPopover = this.loadFragment("Notification").then(function (oPopover) {
					oView.addDependent(oPopover);
					oPopover.setModel(oModel); // Bind model to the fragment
					return oPopover;
				});
			}
			this._pPopover.then(function (oPopover) {
				oPopover.openBy(oButton);
			});
			var oModel = this.getOwnerComponent().getModel("ModelV2");
			this.getView().byId("idnotificationDialog").setModel(oModel)
		},
		//visuvalizations for parking lots
		loadParkingLots: function () {
			var oModel = this.getOwnerComponent().getModel("ModelV2");
			var oParkingLotContainer = this.byId("parkingLotContainer");
			const that = this;
			oModel.read("/PlotNOs", {
				success: function (oData) {
					var emptyCount = 0;
					var notEmptyCount = 0;
					var reservedCount = 0;

					oData.results.forEach(function (oPlot) {
						if (oPlot.available === "Empty") {
							emptyCount++;
						} else if (oPlot.available === "Not Empty") {
							notEmptyCount++;
						} else if (oPlot.available === "Reserved") {
							reservedCount++;
						}

						var oBox = new sap.m.VBox({
							width: "100px",
							height: "100px",
							alignItems: "Center",
							justifyContent: "Center",
							items: [
								new sap.m.Text({
									text: oPlot.plot_NO
								}),
								new sap.m.Text({
									text: oPlot.inBoundOroutBound
								}),
								new sap.m.Link({
									text: oPlot.available,
									press: () => {
										that._handleLinkPress(oPlot.plot_NO);
									},
									enabled: oPlot.available == 'Empty'? false:true
								})
								// new sap.m.Text({
								// 	text: VehicalDeatils.vehicalNo
								// })
							]
						}).addStyleClass(
							oPlot.available === "Empty" ? "greenBackground" :
								oPlot.available === "Not Empty" ? "redBackground" :
									"yellowBackground" // Reserved
						)

						oParkingLotContainer.addItem(oBox);
					}.bind(this));

					// Update the counts in the view
					this.byId("emptyCount").setText("(" + emptyCount + ")");
					this.byId("notEmptyCount").setText("(" + notEmptyCount + ")");
					this.byId("reservedCount").setText("(" + reservedCount + ")");
				}.bind(this),
				error: function (oError) {
					sap.m.MessageToast.show("Error fetching parking lot details.");
				}
			});
		},

		_handleLinkPress: function(plotNum){
			debugger;
			

		},

		//Generating the print form
		triggerPrintForm: function (vehicalDeatils) {
			// Create a temporary print area
			debugger
			var printWindow = window.open('', '', 'height=500,width=800');
			printWindow.document.write('<html><head><title>Parking Lot Allocation</title>');
			printWindow.document.write('<style>body{font-family: Arial, sans-serif;} table{width: 100%; border-collapse: collapse;} td, th{border: 1px solid #ddd; padding: 8px;} th{padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #4CAF50; color: white;}</style>');
			printWindow.document.write('</head><body>');
			printWindow.document.write('<h2>Parking Lot Allocation</h2>');
			printWindow.document.write('<table><tr><th>Field</th><th>Value</th></tr>');
			printWindow.document.write('<tr><td>Vehicle Number</td><td>' + vehicalDeatils.vehicalNo + '</td></tr>');
			printWindow.document.write('<tr><td>Driver Name</td><td>' + vehicalDeatils.driverName + '</td></tr>');
			printWindow.document.write('<tr><td>Phone</td><td>' + vehicalDeatils.phone + '</td></tr>');
			printWindow.document.write('<tr><td>Vehicle Type</td><td>' + vehicalDeatils.vehicalType + '</td></tr>');
			printWindow.document.write('<tr><td>Plot Number</td><td>' + vehicalDeatils.plotNo_plot_NO + '</td></tr>');
			printWindow.document.write('<tr><td>Assigned Date</td><td>' + vehicalDeatils.assignedDate + '</td></tr>');

			// Generate barcode
			debugger
			const barcodeValue = `${vehicalDeatils.vehicalNo}`;
			const canvas = document.createElement('canvas');
			JsBarcode(canvas, barcodeValue, {
				format: "CODE128",
				lineColor: "#0aa",
				width: 4,
				height: 40,
				displayValue: true
			});
			const barcodeImage = canvas.toDataURL("image/png");

			// Add barcode to print
			printWindow.document.write('<tr><td>Barcode</td><td><img src="' + barcodeImage + '" alt="Barcode"></td></tr>');
			printWindow.document.write('</table>');
			printWindow.document.write('</body></html>');
			printWindow.document.close();
			printWindow.print();
		},
		onModel: async function () {
			var oModel = this.getView().getModel("ModelV2");
			var that = this;
			await oModel.read("/Reservation", {
				success: function (oData) {
					var t = oData.results.length;
					that.byId("idnotification7").setValue(t);
				},
				error: function () {
				}
			})

			oModel.refresh()
		},
		onBeforeRendering: function () {
			this.onModel();

		},
		onAfterRendering: function () {
			this.onModel();
		},
		onScannrPress: function (oEvent) {
			debugger
			const that = this
			const oModel = this.getView().getModel("ModelV2");
			BarcodeScanner.scan(
				async function (mResult) {
					mResult && mResult.text
					var scannedText = mResult.text;
					sap.m.MessageBox.show("We got barcode: " + scannedText);
					await that.checkVehicleNo_scan(oModel, scannedText)
				}
			)
		},
		checkVehicleNo_scan: async function (oModel, sVehicalNo) {
			const that = this
			return new Promise((resolve, reject) => {
				oModel.read("/VehicalDeatils", {
					filters: [
						new sap.ui.model.Filter("vehicalNo", sap.ui.model.FilterOperator.EQ, sVehicalNo)
					],
					success: function (oData) {
						resolve(oData.results.length > 0);
						that.byId("commentsTextArea").setValue(sVehicalNo)
					},
					error: function () {
						reject("An error occurred while checking vehicle number existence.");
					}
				});
			});
		},
	});
});
