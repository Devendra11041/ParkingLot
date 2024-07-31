using my.Parking as my from '../db/data-model';

@path: '/ParkinglotSRV'
service CatalogService {
     @restrict: [
        {
            grant: '*',
            to   : 'Admin'
        },
        {
            grant: 'READ',
            to   : 'User'
        }
    ]
    entity PlotNOs        as projection on my.PlotNOs;
    entity VehicalDeatils as projection on my.VehicalDeatils;
    entity Allotment      as projection on my.Allotment;
    entity History        as projection on my.History;
    entity Reservation    as projection on my.Reservation;
}
