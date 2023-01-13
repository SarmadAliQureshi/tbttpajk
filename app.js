const { log } = require('console');
const express = require('express');
const { request } = require('http');
const { loadavg } = require('os');
var path = require('path');
var {Pool} = require('pg');
// bodyParser = require('body-parser');
var pool = require('./connection')
const cors = require('cors');

// To refresh browser automatically on ejs changes
var livereload = require("livereload");
var connectLiveReload = require("connect-livereload");
const liveReloadServer = livereload.createServer();
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

// import sslRedirect from 'heroku-ssl-redirect';


// var L = require('leaflet');
// const pool = new Pool({
//     user: 'postgres',
//     host: 'localhost',
//     database: 'postgres',
//     password: 'postgres',
//     port: 5432,
//   })

app = express()
app.use(connectLiveReload());

app.use(cors({
    origin:'https://cdn.jsdelivr.net/npm/bootstrap@5.2.1/dist/css/bootstrap.min.css',
    origin: 'https://cdn.jsdelivr.net/npm/bootstrap@5.2.1/dist/js/bootstrap.bundle.min.js',
    origin:'https://ec2-18-183-151-66.ap-northeast-1.compute.amazonaws.com/',
    origin:'http://ec2-18-183-151-66.ap-northeast-1.compute.amazonaws.com:5000/'
    
}))
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true}))

app.set('view engine', 'ejs')
app.use(express.static('public'))
// app.use(express.static(path.join(__dirname, 'public'))); //  "public" off of current is root

// Populates the front end fields like buttons and dropdown menus of main page
var zoomtooverlap 
app.get('/', function (req, res) {
    var data_2020_21
    var data_2019_20
    var data_2021_22
    var data_district_boundary
    var forestdivisions
    
    pool.query('select uid, site_name from "ajk_plantation_2020_21"')
    .then((results) => {
        // console.log('aa',results.rows);
        return results.rows
        // res.render('plantation',{data:test_data, data_2020_21: results.rows})
    })
    
    .then((results)=>{
        data_2020_21 = results
        pool.query('select uid, site_name from ajk_plantation_2019_20')
        .then((results) => {
            // console.log('res 1 ',results.rows);
            data_2019_20 = results.rows
            // res.render('plantation',{data:test_data, data_2020_21: data_2020_21,data_2019_20: results.rows});
        })
        .then((results) => {
            pool.query('select division_name,d_uid,f_circle from ajk_forest_divisions order by f_circle asc')
            .then((results) => {
                forestdivisions = results.rows
                pool.query('select uid, site_name from ajk_plantation_2021_22')
                .then((results) => {
                    res.render('plantation',{ data_2020_21: data_2020_21,data_2019_20: data_2019_20,f_division:forestdivisions,data_2021_22:results.rows,overlap:zoomtooverlap});
                })
                // console.log('divs',results.rows);
            })

        })
        
    })
    
})

// display summary of all plantations circle wise
var div_summary 
app.get('/summary', (req, res) => {
    pool.query('select f_circle,f_division,count(site_name) total_sites, p_year, sum(m_area) area_acres from ajk_plantation_all group by f_division,p_year,f_circle order by f_circle,f_division asc')
    .then((results) => {
        // console.log('results',results.rows);
        div_summary = results.rows
        pool.query('select sum(m_area) as total_area,count(uid) as total_sites from ajk_plantation_all')
        .then((result)=>{
            res.render('summary',{summary:div_summary,total_num:result.rows[0]});
        })
    })
});

//displaing overlaping plantation areas
app.get('/overlap',(req, res) => {
    var query = `select a.uid,a.site_name plantation_2020_21,a.f_division div_2021,round(st_area(st_intersection(ST_MakeValid(a.geom),ST_MakeValid(b.geom)))*0.000247105) overlap_area,
    b.site_name plantation_2019_20 , b.f_division div_2019
    from "ajk_plantation_2020_21" a inner join ajk_plantation_2019_20 b
    on st_overlaps(a.geom,b.geom) order by overlap_area desc limit 18`
    pool.query(query)
    .then((results) => {
        // console.log('re',results.rows);
        res.render('overlap', {data: results.rows});
    })
})

//displaing overlaping plantation areas 2021/22
app.get('/overlap2022',(req, res) => {
    var query = `select a.uid,a.site_name plantation_2021_22,a.f_division div_2021_22,round(st_area(st_intersection(ST_MakeValid(a.geom),ST_MakeValid(b.geom)))*0.000247105) as
    overlap_area,
    b.site_name site_name , b.f_division f_division, b.p_year plantation_year
    from ajk_plantation_2021_22  a  inner join ajk_all_plantations_2019_20_21 b 
    on st_overlaps(a.geom,b.geom) order by overlap_area desc limit 8`
    pool.query(query)
    .then((results) => {
        // console.log('re',results.rows);
        res.render('overlap2022', {data: results.rows});
    })
})
//displaing overlaping all plantations with anr_2019_20
app.get('/allplantation_anr1920_overlaps',(req, res) => {
    var query = `select a.uid,a.site_name plantation_name,a.f_division plantation_div,a.p_year as p_year,
	(round(st_area(st_intersection(ST_MakeValid(a.geom),ST_MakeValid(b.geom)))*0.000247105)) as overlap_area,
    b.site_name anr_2019_20 , b.f_division anr_div
    from ajk_plantation_all a inner join ajk_anr_2019_2020_polygons b
    on st_overlaps(a.geom,b.geom)
	where (round(st_area(st_intersection(ST_MakeValid(a.geom),ST_MakeValid(b.geom)))*0.000247105))>5
	order by p_year desc  `
    pool.query(query)
    .then((results) => {
        // console.log('re',results.rows);
        res.render('allplantation_anr1920_overlaps', {data: results.rows});
    })
})


// Fetching all data to display polygons on map
app.get('/data',(req, res) => {

    var select_all_data_2021_22 = `
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(feature)
      )
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
          'properties', jsonb_build_object(
              'name', site_name,
              'id', uid,
                'F_Division',F_Division,
              'M_Area',M_Area,
              'P_Year',p_year,
              'C_Area',C_Area
          )
        ) AS feature
        FROM ajk_plantation_2021_22
      ) features`

    // Puts all data on map
    var select_all_data_2020_21 = `
    
    SELECT jsonb_build_object(
    'type',     'FeatureCollection',
    'features', jsonb_agg(feature)
  )
  FROM (
    SELECT jsonb_build_object(
      'type',       'Feature',
      'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
      'properties', jsonb_build_object(
          'name', site_name,
          'id', uid,
	  	  'F_Division',F_Division,
          'M_Area',M_Area,
          'P_Year',p_year,
          'C_Area',C_Area
	  )
    ) AS feature
    FROM "ajk_plantation_2020_21"
  ) features
      `
      var select_all_data_2019_20 = `
    
    SELECT jsonb_build_object(
    'type',     'FeatureCollection',
    'features', jsonb_agg(feature)
  )
  FROM (
    SELECT jsonb_build_object(
      'type',       'Feature',
      'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
      'properties', jsonb_build_object(
          'name', site_name,
          'id', uid,
	  	'F_Division',F_Division,
        'M_Area',M_Area,
        'P_Year',p_year,
        'C_Area',C_Area
	  )
    ) AS feature
    FROM ajk_plantation_2019_20
  ) features
      `

      var select_ajk_distict_boundary = `
      SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(feature)
      )
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
          'properties', jsonb_build_object(
              'name', name
          )
        ) AS feature
        FROM ajk_district_boundaries
      ) features
    `
    
    // pool.query('select id,name,ST_AsGeoJSON(polygon) as geometry from areas limit 1 ')
    pool.query(select_all_data_2019_20) 
    .then((results)=>{
        // console.log('results 1', results.rows[0].jsonb_build_object);
        return results.rows[0].jsonb_build_object
        
        // res.send(results.rows[0].jsonb_build_object)
    })
        .then((results)=>{
        // console.log('results 2', results);
        var data19 = results
        var data_2020_21
        var data_2021_22
        pool.query(select_all_data_2020_21)
        .then((results)=>{
            // console.log('results 3',data19);
            data_2020_21 = results.rows[0].jsonb_build_object
            pool.query(select_ajk_distict_boundary)
            // res.send({data2019_20:data19,data2020_21:results.rows[0].jsonb_build_object})
            .then((results)=>{
                data_district_boundary = results.rows[0].jsonb_build_object
                pool.query(select_all_data_2021_22)
                .then((results)=>{
                    data_2021_22 = results.rows[0].jsonb_build_object
                    res.send({data2019_20:data19,data2020_21:data_2020_21,disttricts:data_district_boundary,data2021_22:data_2021_22})
                })
                

            })
        })
        // res.send(results.rows[0].jsonb_build_object)
    })
    
    // res.send(test_data)
})

// Fetching ANR 2019_20 data 
app.get('/anr2019_20',(req,res)=>{
    var select_2019_20_anr =   `
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(feature)
      )
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
          'properties', jsonb_build_object(
              'name', site_name,
              'id', uid,
              'F_Division',F_Division,
            'M_Area',M_Area,
            'P_Year',p_year
          )
        ) AS feature
        FROM ajk_anr_2019_2020_polygons
      ) features
    
    `
    pool.query(select_2019_20_anr)
    .then((result)=>{
        // console.log('ANR :', result.rows[0].jsonb_build_object);
        res.send(result.rows[0].jsonb_build_object)
    })
})

//Fetching data based on divisions
app.get('/division/:id',(req,res)=>{
    console.log('res',req.params.text);
    var select_data_by_Forest_division = `
    SELECT jsonb_build_object(
            'division_id','${req.params.id}',
            'type',     'FeatureCollection',
            'features', jsonb_agg(feature)
        )
        FROM (
            SELECT jsonb_build_object(
            'type',       'Feature',
            'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
            'properties', jsonb_build_object(
                'name', site_name,
                'id', uid,
                'F_Division',F_Division,
                'M_Area',M_Area,
                'P_Year',p_year,
                'C_Area',c_area
            )
            ) AS feature
            FROM ajk_plantation_all where d_uid = '${req.params.id}'
        ) features
    
      `
        // console.log('div',select_data_by_Forest_division);
      pool.query(select_data_by_Forest_division)
      .then((results) => {
        res.send(results.rows[0].jsonb_build_object);
      })

})

// Showing the list of forest divisions home page


app.get('/api',(req, res, next)=>{
    res.send({a:'sar',b:'postgres'})
})
app.get('/data/:id',(req, res, next) => {
    console.log(req.params.id);
    console.log('in else');
            var select_by_id_2019 = `
    
            SELECT jsonb_build_object(
                'type',     'FeatureCollection',
                'features', jsonb_agg(feature)
            )
            FROM (
                SELECT jsonb_build_object(
                'type',       'Feature',
                'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
                'properties', jsonb_build_object(
                    'name', site_name,
                    'id', uid,
                    'Forest Division',F_Division
                )
                ) AS feature
                FROM ajk_plantation_all where uid = '${req.params.id}'
            ) features
            `
            pool.query(select_by_id_2019)
            .then((result) => {
                res.send(result.rows[0].jsonb_build_object)

            })
    
})

// On clicking row in overlaps table zoom to that site on map
app.post('/overlap/:id', (req, res) => {
    console.log('abc1',req.params.id);
    query = `
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(feature)
    )
    FROM (
        SELECT jsonb_build_object(
        'type',       'Feature',
        'geometry',   ST_AsGeoJSON(st_transform((geom),4326))::jsonb,
        'properties', jsonb_build_object(
            'name', site_name,
            'id', uid,
            'Forest Division',F_Division
        )
        ) AS feature
        FROM ajk_plantation_all where uid = '${req.params.id}'
    ) features
    `
    // console.log(query);
    pool.query(query)
    .then((result) => {
        console.log(result.rows[0].jsonb_build_object.features[0].properties.id);
        zoomtooverlap = result.rows[0].jsonb_build_object.features[0].properties.id
        res.send({'db':'postgres'});
    })
    
})


const port = process.env.PORT || 5000;
app.listen(80,()=>{
    zoomtooverlap = null
    console.log('listening on port :'+80);
});

