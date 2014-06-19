/*
    Uppgift 4.2 - Webblagring (Local Storage)
    av Ida Svensson  

    Jag har läst på flera ställen om att jQuery Mobile inte skulle vara optimalt för 
    PhoneGap-appar sedan det från början är utvecklat för mobila webbsidor och blir
    därför ett tungt ramverk för en app vilket kan sänka prestandan rejält, så därför
    valde jag att testa att jobba enbart med PhoneGap från scratch. Det har krävt 
    en del enklare fixar och egen mindre robust funktion för 'changePage' bl.a., men
    var en skön utmaning att testa sig på. Det fyller sin funktion nu, men skulle behöva
    mycket mer puts i en riktig app. Just nu skulle det bara stödja programmeringen,
    som ju är kursens fokus.

    Har blandat lite svenska och engelska i kommentarerna, sorry för det. Tanken var nog
    att skriva på svenska för uppgiftens skull, men faller in i gamla vanor och kommenterar
    alltid på engelska så, ja. Ni får ha överseende där. Mycket säger sig självt eller är 
    mer noggrannt beskrivet i uppgifter där jag använt funktionerna, så har kommenterat där
    det kändes som att det behövdes.

    Tack för den här kursen!
*/

/*globals $, jQuery, Handlebars, google*/ /* For JSLint */

$(function() {

    var app = {

        init: function() {
            this.bindEvents();
            this.noteListView = null;
            this.noteList = null;
            this.singlePage = null;
            this.noteForm = null;
            this.db = null;
        },

        bindEvents: function() {
            $(document).on('deviceready', this.onDeviceReady);
        },

        onDeviceReady: function() {
            // Öppna en databas med pluginet SQLitePlugin för PG som erbjuder större databasutrymme.
            app.db = window.sqlitePlugin.openDatabase('notes');

            // "Globala" dom-objekt för användning inom appen
            app.noteListView = $('#note-listview');
            app.noteList = $('#note-list');
            app.singlePage = $('#single-note-page');
            app.noteForm = $('#note-form');

            // See if database exists and determine wether to open or create.
            app.testIfDatabaseExists();

            /* 
             Testa hastighet för direkt touchend call vs. touchstart 
             och SEDAN lyssna efter touchend utanför, för avbryt...
             */

            // Event Handlers
            app.noteList.on('touchstart', 'li', app.openEntry); // Fix for attaching event handler to li's that don't exist yet.
            $('#add').on('touchstart', app.prepNewNote);
            $('#edit').on('touchstart', app.editEntry);
            app.noteForm.on('touchstart', '#delete', app.deleteEntry); // Same fix as above
            $('.attached-media').on('touchstart', 'a', app.undisplayMedia); // Same fix again
            $('#capture-photo').on('touchstart', app.capturePhoto); 
            $('#get-photo').on('touchstart', app.getPhoto);
            $('#record-sound').on('touchstart', app.captureAudio);
            $('#capture-video').on('touchstart', app.captureVideo);
            $('#save-note').on('touchstart', app.writeEntry);
            $(document).on('backbutton', app.onBackButton); // Override native back button on Android device.
        },

        /*********************************************************/
        /* UI Scripts & Templating */
        /*********************************************************/

        // My own attempt at a jQuery-like function for changing pages within same file.
        changePage: function( id ) {
            var pages = [
                    'home-page', 
                    'add-note-page', 
                    'single-note-page'
                ],
                index = $.inArray(id, pages);

            console.log( 'Page target: ' + id + ' at index ' + index );

            // Hide non-targeted pages
            $.each( pages, function(i, val) {
                if ( val === id ) { return; }
                console.log('Attempting to remove hidden class on page ' + val);
                $('#' + val).addClass('ui-hidden');
            });

            // Show the targeted one
            $('#' + id).removeClass('ui-hidden');
        },

        // Handle native back button
        onBackButton: function(ev) {
            ev.preventDefault();
            app.changePage('home-page'); // Always go to home page. Easy fix.
            console.log('Triggered back button.');
        },

        prepNewNote: function(id) {
            console.log('Prepping note');
            app.changePage( 'add-note-page' );

            // If id is set, pre-populate with existing note data for edit.
            if ( id[0] !== undefined ) {
                app.noteForm.attr('data-id', id);
                console.log('Added data-id: ' + id[0] + ' to ' + app.noteForm.attr('data-id'));
                app.db.transaction( app.readNoteData, app.onTxError, app.onTxSuccess );

                // Add Delete-button
                var delBtn = $('<input type="button" id="delete" value="Delete"></input>');
                app.noteForm.append(delBtn);
            } else {
                $('#add-note-page').find('.attached-media').remove();
                // Get Current Position, only on first time inserting the data.
                navigator.geolocation.getCurrentPosition( app.onGeoSuccess, app.onError );
            }

        },

        readNoteData: function(tx) {
            var id = app.noteForm.attr('data-id');
            var sqlStr = 'SELECT * FROM Notes WHERE id LIKE "' + id + '"';
            tx.executeSql( sqlStr, [], app.populateFormData, app.onSqlError );
        },

        populateFormData: function(tx, results) {
            var title = results.rows.item(0).title,
                text = results.rows.item(0).text,
                photopath = results.rows.item(0).photopath,
                videopath = results.rows.item(0).videopath,
                audiopath = results.rows.item(0).audiopath,
                page = $('#add-note-page');

            $('#add-note-page').find('.ui-page-title').text(title);
            console.log('Successfully got note data. Time to populate form.');

            if ( title ) { $('#new-note-title').val( title ); }
            if ( text ) { $('#new-note-text').val( text ); }
            if ( photopath ) { app.displayMedia( page, 'photo', photopath ); }
            if ( videopath ) { app.displayMedia( page, 'video', videopath ); }
            if ( audiopath ) { app.displayMedia( page, 'audio', audiopath ); }
        },

        onGeoSuccess: function(position) {
            console.log('Attempting to find geolocation.');
            var lat = position.coords.latitude,
                lng = position.coords.longitude,
                geocoder = new google.maps.Geocoder(),
                latlng = new google.maps.LatLng(lat, lng);

            /* Skicka till Google Maps API för att få tillbaka ortnamn och lägg det i 'data-location' för mapmarker-diven */
            console.log('Location LatLng: ' + latlng);
            geocoder.geocode( {'latLng': latlng}, app.useGeoLocation );
        },

        useGeoLocation: function(results, status) {
            console.log('Got geolocation. Time to use it.');

            var displayText;

            if ( status === google.maps.GeocoderStatus.OK ) {
                if ( results[1] ) {
                    displayText = results[1].formatted_address;
                }
            } else {
                displayText = 'Location not found.';
            }

            $('#add-note-page').find('.note-location').text( displayText );
        },

        /*********************************************************/
        /* Setup Database */
        /*********************************************************/

        testIfDatabaseExists: function() {
            var exists = window.localStorage.getItem("dbExists"); // När vi skapar vår databas sätter vi denna variabel till sann.
            
            if ( exists === null) 
            {
                app.createDatabase();
            }
            else
            {
                app.readDatabase();
            }

        },

        createDatabase: function() {
            // Kör SQL Queries på databasen med metoden transaction.
            app.db.transaction( app.setupDB, app.onTxError, app.onSetupSuccess );
        },

        setupDB: function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS Notes');
            tx.executeSql('CREATE TABLE IF NOT EXISTS Notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title VARCHAR, text TEXT, date DATE, location VARCHAR, photopath VARCHAR, audiopath VARCHAR, videopath VARCHAR)');
        },

        onSetupSuccess: function() {
            window.localStorage.setItem("dbExists", 1); // Set the variable to true
            console.log("Database successfully created.");
        },

        /*********************************************************/
        /* Read from Database & Display Results */
        /*********************************************************/

        readDatabase: function() {
            console.log("Database exists. Time to read the data.");
            app.db.transaction( app.readAllData, app.onTxError, app.onTxSuccess );
        },

        readAllData: function(tx) {
            tx.executeSql('SELECT * FROM Notes', [], app.renderNoteList, app.onSqlError );
        },

        onTxSuccess: function() {
            console.log("TX Success.");
        },

        onTxError: function(error) {
            var msg;

            if (error) {
                msg = "TX Error: " + error.message + " (" + 
                    error.code + ")";
            } else {
                msg = "Unknown error.";
            }

            console.log(msg);
            navigator.notification.alert(msg, null, 'Error');
        },

        renderNoteList: function(tx, results) {
            if ( results.rows ) {
                var len = results.rows.length;
                if ( len > 0 ) {

                    for (var i = 0; i < len; i++) {

                        var li = $('<li></li>'),
                            id = results.rows.item(i).id,
                            title = results.rows.item(i).title,
                            text = results.rows.item(i).text,
                            photopath = results.rows.item(i).photopath,
                            videopath = results.rows.item(i).videopath,
                            audiopath = results.rows.item(i).audiopath,
                            lastModified = results.rows.item(i).created,
                            excerpt;
                            
                        if ( !text || text === undefined ) { 
                            excerpt = '';
                        } else if ( text.length > 60 ) {
                            excerpt = text.substring(0, 60) + '...' 
                        } else {
                            excerpt = text;
                        }

                        console.log('Photo: ' + photopath + ', Excerpt: ' + excerpt);

                        var htmlString =
                            '<div class="note-content">' +
                                '<h2 class="note-title">' + title + '</h2>' +
                                '<p class="note-excerpt">' + excerpt + '</p>' +
                            '</div>';

                        li.html( htmlString );
                        li.addClass('note-item');
                        li.attr('data-id', id);

                        var thumb = $('<div></div>');
                        thumb.addClass('note-thumb');
                        li.prepend( thumb );

                        // Om anteckningen har en bifogad bild, lägg den som thumbnail.
                        if ( photopath ) {
                            thumb.css('background-image', 'url(' + photopath + ')');
                        } else if ( videopath ) {
                            thumb.css('background-image', 'url(img/video-default.png)');
                        } else if ( audiopath ) {
                            thumb.css('background-image', 'url(img/audio-default.png)');
                        } else {
                            thumb.css('background-image', 'url(img/thumb-default.png)');
                        }
                        
                        app.noteList.append(li);

                    }

                    // Töm form elementen
                    $('#new-note-title').val('');
                    $('#new-note-text').val('');

                } else {
                    console.log("No records processed.");
                }
            } else {
                app.noteListView.html("There are no notes. Create one by tapping the +-sign.");
            }
        },

        onSqlError: function(error) {
            var msg;

            if (error) {
                msg = "SQL Error: " + error.message +
                " (" + error.code + ")";
            } else {
                msg = "Unknown error.";
            }

            console.log(msg);
            alert(msg);
        },

        /*********************************************************/
        /* Add New Note Entry */
        /*********************************************************/

        writeEntry: function(ev) {

            app.db.transaction( app.newEntry, app.onTxError, app.onTxSuccess );

        },

        newEntry: function(tx) {
            var sqlStr,
                title = $('#new-note-title').val(),
                text = $('#new-note-text').val(),
                // Datumobjekt för den aktuella tiden när inlägget sparas.
                date = new Date(),
                lmYear = date.getFullYear(),
                lmMonth = date.getMonth(),
                lmDate = date.getDate(),
                lmHours = date.getHours(),
                lmMins = date.getMinutes()<10?'0':'' + date.getMinutes(),
                lastModified = lmYear + '/' + lmMonth + '/' + lmDate + ' ' + lmHours + ':' + lmMins,
                location = $('#add-note-page').find('.note-location').text(),
                mediaName,
                mediaPath;

            if ( $('#add-note-page .attached-media img').get(0) ) {
                mediaName = 'photopath',
                mediaPath = $('.attached-media img').attr('src');
            } else if ( $('#add-note-page .attached-media video').get(0) ) {
                mediaName = 'videopath',
                mediaPath = $('.attached-media video').attr('src');
            } else if ( $('#add-note-page .attached-media audio').get(0) ) {
                mediaName = 'audiopath',
                mediaPath = $('.attached-media audio').attr('src');
            }

            var noteId = app.noteForm.attr('data-id');

            /*
                See if new note or old one opened for edit, then either insert to database or update.
            */

            if ( !noteId ) {
                // New note: Insert
                if ( !mediaName || !mediaPath ) {
                    sqlStr = 'INSERT INTO Notes (title, text, date, location) VALUES (?, ?, ?, ?)';
                    console.log('Attempting to add note entry: Title: ' + title);
                    tx.executeSql( sqlStr, [title, text, lastModified, location], app.onAddSuccess, app.onSqlError );
                } else {
                    var sqlStr = 'INSERT INTO Notes (title, text, date, location, ' + mediaName + ') VALUES (?, ?, ?, ?, ?)';
                    console.log('Attempting to add media entry: Media name: ' + mediaName + ', Media path: ' + mediaPath);
                    tx.executeSql( sqlStr, [title, text, lastModified, location, mediaPath], app.onAddSuccess, app.onSqlError );
                }
            } else {
                // Existing note: Update
                if ( !mediaName || !mediaPath ) {
                    var sqlStr = 'UPDATE Notes SET title=?, text=?, date =? WHERE id=?';
                    console.log('Attempting to update note entry: Title: ' + title);
                    tx.executeSql( sqlStr, [title, text, lastModified, noteId], app.onUpdateSuccess, app.onSqlError );
                } else {
                    var sqlStr = 'UPDATE Notes SET title=?, text=?, date =?, ' + mediaName + '=? WHERE id=?';
                    console.log('Attempting to update media entry: Media name: ' + mediaName + ', Media path: ' + mediaPath);
                    tx.executeSql( sqlStr, [title, text, lastModified, mediaPath, noteId], app.onUpdateSuccess, app.onSqlError );
                }
            }
        },

        onAddSuccess: function(tx, results) {
            console.log("Note successfully added.");
            alert("Anteckning sparad!");

            app.changePage('home-page');

            $('add-note-page').find('.attached-media').empty();
        },

        /*********************************************************/
        /* Edit & Update Existing Note Entry */
        /*********************************************************/

        editEntry: function(ev) {
            var id = $('#single-note-page').attr('data-id');
            console.log('Opening note ' + id + ' for editing.');

            // Remove any already showing media.
            $('#add-note-page').find('.attached-media').remove();

            app.prepNewNote(id);
            
        },

        updateEntry: function(tx) {
            var text = $("textarea").val();
            var date = new Date().getTime().toString();
            var id = app.noteForm.attr('data-id');

            console.log('Trying to update ' + id + ', ' + text);
            var sqlStr = 'UPDATE Notes SET text=?, date =? WHERE id=?';

            tx.executeSql( sqlStr, [text, date, id], app.onUpdateSuccess, app.onSqlError );
        },

        onUpdateSuccess: function(tx, results) {
            alert('Anteckning uppdaterad!');

            app.changePage('home-page');

            $('add-note-page').find('.attached-media').empty(); // Behövs det?
        },

        /*********************************************************/
        /* Open & Display Note Entry */
        /*********************************************************/

        openEntry: function(ev) {
            var id = $(this).attr('data-id');
            console.log('Opening note ' + id);

            // Remove any already showing media.
            $('#single-note-page').find('.attached-media').remove();

            app.changePage('single-note-page');
            $('#single-note-page').attr('data-id', id);

            app.db.transaction( app.showEntry, app.onTxError, app.onTxSuccess );
            
        },

        showEntry: function(tx) {
            var id = $('#single-note-page').attr('data-id'); /* Ingen .data() genererar null, ingen .attr() genererar undefined */

            if (id) {   
                console.log('Found id: ' + id);
                var sqlStr = 'SELECT * FROM Notes WHERE id LIKE "' + id + '"';
                tx.executeSql( sqlStr, [], app.onShowSuccess, app.onSqlError );
            } else {
                console.log('No data id.');
            }
            
        },

        onShowSuccess: function(tx, results) {
            var title = results.rows.item(0).title,
                text = results.rows.item(0).text,
                lastModified = results.rows.item(0).date,
                photopath = results.rows.item(0).photopath,
                videopath = results.rows.item(0).videopath,
                audiopath = results.rows.item(0).audiopath,
                location = results.rows.item(0).location,
                page = $('#single-note-page');

            console.log('Show success!');

            if ( title ) {
                // Shorten title and append ellipsis is longer than 18 chars.
                if ( title.length > 18 ) { 
                    title = title.substring(0, 18) + '...';
                }
                $('#note-title').text( title );
            }
            if ( text ) { $('#note-text').text( text ); }
            if ( photopath ) { app.displayMedia( page, 'photo', photopath ); }
            if ( videopath ) { app.displayMedia( page, 'video', videopath ); }
            if ( audiopath ) { app.displayMedia( page, 'audio', audiopath ); }
            if ( location ) { 
                var htmlString = '<span class="ui-icon-grey ui-icon-notext ui-icon-mapmarker"></span>' + location;
                $('#single-note-page').find('.note-location').html( htmlString ); 
            }

            $('#single-note-page').find('.note-date').text( lastModified );
            
        },

        /*********************************************************/
        /* Delete Note Entry */
        /*********************************************************/

        deleteEntry: function(ev) {
            app.db.transaction( app.doDeleteEntry, app.onTxError, app.onTxSuccess );
        },

        doDeleteEntry: function(tx) {
            var id = app.noteForm.attr('data-id');

            console.log('Attempting to delete entry with id: ' + id);

            if (id) {
                var sqlStr = 'DELETE FROM Notes WHERE id=' + id;
                tx.executeSql( sqlStr, [], app.onDeleteSuccess, app.onSqlError );
            } 

        },

        onDeleteSuccess: function(tx, results) {
            console.log("Note successfully deleted.");

            // Skicka med ett objekt som andra variabel här med id-data och ändra om allt efter det!
            alert("Anteckning raderad.");
            app.changePage( 'home-page' ); // Skicka till startsidan

            app.noteForm.attr('data-id', ''); // Nollställ divens id
        },

        /*********************************************************/
        /* Add Photo from Camera */
        /*********************************************************/

        capturePhoto: function() {
            if ( $(this).hasClass('deactivated') ) {
                navigator.notification.alert('Du kan bara bifoga en fil per anteckning.', null, 'Hoppsan!');
            } else {
                console.log('Attempting to capture photo');
                navigator.device.capture.captureImage( app.onCapturePhotoSuccess, app.onPhotoError, { limit : 1 } );
            }
            
        },

        onCapturePhotoSuccess: function(mediaFiles) {
            for ( var i = 0; i < mediaFiles.length; i++ ) {
                
                var path = mediaFiles[i].fullPath;

                var name = mediaFiles[i].name,
                    datetime = mediaFiles[i].lastModifiedDate,
                    htmlString =    "Fotograferingen lyckades!<br />" +
                                    "<strong>Sökväg:</strong> " + path + "<br />" +
                                    "<strong>Namn:</strong> " + name + "<br />" +
                                    "<strong>Senast ändrad:</strong> " + datetime;

                app.displayMedia( $('#add-note-page'), 'photo', path );

            }
        },

        displayMedia: function(page, type, path) {
            var container = page.find('.attach-bar'),
                mediaContainer = $('<div></div>'),
                htmlString;

            if ( type === 'photo' ) {
                htmlString =    '<img src="' + path + '" />';
            } else if ( type === 'audio' ) {
                htmlString =    '<audio src="' + path + '" controls></audio>';
            } else if ( type === 'video' ) {
                htmlString =    '<video src="' + path + '" width="320" height="240" controls></video>';
            } else {
                htmlString = '<p>Something went wrong. Try again.</p>';
            }

            mediaContainer
                .addClass('attached-media')
                .html(htmlString);

            console.log('Container: ' + container.attr('class') + ', Page: ' + page.attr('id') );

            /* 
                If on add-note-page - "deactivate" media buttons by lowering opacity and 
                trigger alert on tap to show user only one media can be attached at a time.
            */
            if ( page.attr('id') === 'add-note-page' ) {
                container.find('.media-btn').addClass('deactivated');
                console.log( 'Added class: ' + container.find('.media-btn').attr('class') );
            } 

            container.prepend(mediaContainer); // Prepend attached media to attach bar, above media buttons.
        },

        undisplayMedia: function(ev) {
            console.log('Clicked delete button');
            
            // Remove the attached media div.
            $('.attached-media').remove();
            // Remove class 'deactivated' on media buttons to enable adding new media.
            $('.media-btn').removeClass('deactivated');
        },

        onPhotoError: function(error) {
            if ( error.code == 3 ) {
                return; // Process cancelled by user, no feedback needed.
            } else {
                navigator.notification.alert( error.message, null, 'Error' );
            }
        },

        /*********************************************************/
        /* Add Photo from Device */
        /*********************************************************/

        getPhoto: function() {
            if ( $(this).hasClass('deactivated') ) {
                navigator.notification.alert('Du kan bara bifoga en fil per anteckning.', null, 'Hoppsan!');
            } else {
                console.log('Attempting to get photo from device');
                var options = {
                    quality: 50,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
                    encodingType: Camera.EncodingType.JPEG,

                };
                navigator.camera.getPicture( app.onGetPhotoSuccess, app.onPhotoError, options );
            }
        
        },

        onGetPhotoSuccess: function(imageURI) {
            app.displayMedia( $('#add-note-page'), 'photo', imageURI );
        },

        /*********************************************************/
        /* Add Audio Recording */
        /*********************************************************/

        captureAudio: function() {
            if ( $(this).hasClass('deactivated') ) {
                navigator.notification.alert('Du kan bara bifoga en fil per anteckning.', null, 'Hoppsan!');
            } else {
                console.log('Attempting to capture audio');
                navigator.device.capture.captureAudio(app.onCaptureAudioSuccess, app.onError, { limit: 1 });
            }
        },

        onCaptureAudioSuccess: function(mediaFiles) {
            for ( var i = 0; i < mediaFiles.length; i++ ) {
                
                var path = mediaFiles[i].fullPath;

                var htmlString =    "Inspelningen lyckades!<br />" +
                                    "<strong>Sökväg:</strong> " + path + "<br />" +
                                    "<strong>Namn:</strong> " + mediaFiles[i].name + "<br />";
                                    

                var formatSuccess = function(mediaFile) {
                    var duration = mediaFile.duration;
                };

                app.displayMedia( $('#add-note-page'), 'audio', path );

            }
        },

        playAudio: function() {
            if ( path != undefined ) {
                var audioPlayer = $("#player");
                audioPlayer.find("source").attr('src', path);
                audioPlayer.trigger("play"); // Ovverride for jQuery play...
                app.output.html("Ljudet spelas upp...");
            } else {
                navigator.notification.alert("Du har inte spelat in något ljud!", null, "Uh oh!");
            }
        },

        /*********************************************************/
        /* Add Movie Clip from Camera */
        /*********************************************************/

        captureVideo: function() {
            if ( $(this).hasClass('deactivated') ) {
                navigator.notification.alert('Du kan bara bifoga en fil per anteckning. Ta bort den bifogade filen för att lägga till en ny.', null, 'Hoppsan!');
            } else {
                console.log('Attempting to capture video');
                navigator.device.capture.captureVideo( app.onVideoSuccess, app.onError, { limit : 1 } );
            }
        },

        onVideoSuccess: function(mediaFiles) {
            for ( var i = 0; i < mediaFiles.length; i++ ) {
                
                var path = mediaFiles[i].fullPath;

                var name = mediaFiles[i].name,
                    datetime = mediaFiles[i].lastModifiedDate,
                    htmlString =    "Filmningen lyckades!<br />" +
                                    "<strong>Sökväg:</strong> " + path + "<br />" +
                                    "<strong>Namn:</strong> " + name + "<br />" +
                                    "<strong>Senast ändrad:</strong> " + datetime;

                app.displayMedia( $('#add-note-page'), 'video', path );
            }
        },

        playVideo: function() {
            if ( path != undefined ) {
                var videoPlayer = $("#player");
                videoPlayer.attr('src', path);
                videoPlayer.trigger("play"); // Ovverride for jQuery play...
                app.output.html("Filmen spelas upp...");
            } else {
                navigator.notification.alert("Du har inte spelat in någon film!", null, "Uh oh!");
            }
        },

        /*********************************************************/
        /* Handle General Error */
        /*********************************************************/

        onError: function(error) {
            navigator.notification.alert( error.message, null, 'Error' );
        }

    };

    app.init();

});