const { log } = require('console');
const express = require('express');
const { request } = require('http');
const { loadavg } = require('os');
var path = require('path');
var {Pool} = require('pg');
// bodyParser = require('body-parser');
var pool = require('./connection')
const cors = require('cors');

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
    
    pool.query('select uid, site_name from "ajk_plantation_2020_21"')
    .then((results) => {
        // console.log('aa',results.rows);
        return results.rows
        // res.render('plantation',{data:test_data, data_2020_21: results.rows})
    })
    
    .then((results)=>{
        data_2020_21 = results
        pool.query('select uid, site_name from "ajk_spring_plantation_2019-20_final"')
        .then((results) => {
            // console.log('res 1 ',results.rows);
            data_2019_20 = results.rows
            // res.render('plantation',{data:test_data, data_2020_21: data_2020_21,data_2019_20: results.rows});
        })
        .then((results) => {
            pool.query('select division_name,d_uid,f_circle from ajk_forest_divisions order by f_circle asc')
            .then((results) => {
                // console.log('divs',results.rows);
                res.render('plantation',{ data_2020_21: data_2020_21,data_2019_20: data_2019_20,f_division:results.rows,overlap:zoomtooverlap});
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
    var query = `select a.uid,a.site_name plantation_2020_21,a.f_division div_2021,(st_area(st_intersection(ST_MakeValid(a.geom),ST_MakeValid(b.geom)))*0.000247105) overlap_area,
    b.site_name plantation_2019_20 , b.f_division div_2019
    from "ajk_plantation_2020_21" a inner join "ajk_spring_plantation_2019-20_final" b
    on st_overlaps(a.geom,b.geom) order by overlap_area desc`
    pool.query(query)
    .then((results) => {
        // console.log('re',results.rows);
        res.render('overlap', {data: results.rows});
    })
})


// Fetching all data to display polygons on map
app.get('/data',(req, res) => {
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
          'P_Year',p_year
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
        'P_Year',p_year
	  )
    ) AS feature
    FROM "ajk_spring_plantation_2019-20_final"
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
        pool.query(select_all_data_2020_21)
        .then((results)=>{
            // console.log('results 3',data19);
            data_2020_21 = results.rows[0].jsonb_build_object
            pool.query(select_ajk_distict_boundary)
            // res.send({data2019_20:data19,data2020_21:results.rows[0].jsonb_build_object})
            .then((results)=>{
                res.send({data2019_20:data19,data2020_21:data_2020_21,disttricts:results.rows[0].jsonb_build_object})

            })
        })
        // res.send(results.rows[0].jsonb_build_object)
    })
    
    // res.send(test_data)
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
                'P_Year',p_year
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
    var select_by_id = `
    
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
              'Forest Division',F_Division,
              'M_Area',M_Area
          )
        ) AS feature
        FROM "ajk_plantation_2020_21" where uid = '${req.params.id}'
      ) features
      `
    // console.log('resp',select_by_id);
    pool.query(select_by_id)
    .then((result) => {
        // var result = result.rows[0].jsonb_build_object.features
        // console.log('result by id',result.rows[0].jsonb_build_object);
        if(result.rows[0].jsonb_build_object.features){
        res.send(result.rows[0].jsonb_build_object)
    }
        else{
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
                FROM "ajk_spring_plantation_2019-20_final" where uid = '${req.params.id}'
            ) features
            `
            pool.query(select_by_id_2019)
            .then((result) => {
                res.send(result.rows[0].jsonb_build_object)

            })
        }
        // res.render('zoomtoselectedplantation',{data:result.rows[0].jsonb_build_object,api:req.params.id})
    })
    
})

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
// app.use(sslRedirect([
//     'development',
//     'production'
//     ]));
app.listen(port,()=>{
    zoomtooverlap = null
    console.log('listening on port :'+port);
});

